---
layout: post
title:  "A stupidly simple spatial data structure"
date:   2022-08-16 21:00:00 +0300
categories: programming
---

### Preface

*Arrays are great.* Constant-time access by key (index), extremely cache-friendly iteration. Even if you want to add elements (say, to the end of the array), there's a [well-established procedure](https://en.wikipedia.org/wiki/Dynamic_array): allocate a new array twice the previous size, copy the previous array into the first half of the new one, and add your elements. By always allocating twice the previous array, we always need twice as much new elements to force another reallocation, thus the [amortized cost](https://en.wikipedia.org/wiki/Amortized_analysis) of reallocations (cost averaged over all insert operations) is still constant. *Technically, it doesn't matter whether we reallocate exactly twice the size; multiplying by any constant greater than 1 would technically do. Something way bigger than 2 would waste too much memory; something around [1.6](https://en.wikipedia.org/wiki/Golden_ratio) would work better with memory fragmentation. Note that fixed-sized increments don't work here: the amortized cost becomes linear instead of constant.*

Unfortunately, arrays don't work when your keys are no longer consecutive non-negative integers, but are instead strings, points in space, or images.

*Hashtables are great.* They are a nice enough generic solution for a generic key-value mapping; they allow you to map arbitrary keys to arbitrary values, as long as you know how to efficiently convert your keys to some meaningless random-ish numbers.

Unfortunately, hashtables have a lot of issues. Their performance depends heavily on how good your hash function is (a hash that is always equal to zero works perfectly fine, except that you've basically reduced the performance to a linked list); whether it uses [closed](https://en.wikipedia.org/wiki/Hash_table#Separate_chaining) or [open](https://en.wikipedia.org/wiki/Hash_table#Open_addressing) addressing; whether the API requires [persistent references](https://stackoverflow.com/a/39869063/2315602) to stored objects or not. Iteration is typically done by maintaining a separate linked list of stored objects and is therefore quite cache-unfriendly.

### The problem

One day, I was profiling terrain rendering in my martian-colony-building project. Something that looks like this:

<center><img src="{{site.url}}/blog/media/array/terrain.png"></center><br/>
<br/>
*I hope you're not sick of these screenshots; I promise I'll work on more varied terrain generation in a month or two.*

A substantial amount of time was spent in simply gathering the terrain chunks (32x32x32 batches of blocks) that need rendering. These chunks are referenced by their spatial ID (3 integers) and are stored in a standard `unordered_map`. Upon further investigation, I noticed that most time was spent in two functions:

- Computing the hash of a chunk ID
- Comparing two chunk ID's

Certainly, too many comparisons mean there are too many collisions, pointing that my hash function isn't good enough (it is something derived from `boost::hash_combine`). While there are numerous ways to improve performance with a better hash function & hash table implementation, I started to wonder whether I need a hash table at all?

My chunk ID's aren't random: if the player visited or saw a chunk, chances are they've also seen a lot of surrounding chunks. If the player has been to chunks A and B, most probably they travelled from A to B along some path & saw a huge number of chunks in between. What I'm saying is that it is reasonable to assume that chunks form a connected, maybe convex (but not necessarily) set. And, remember that chunks ID's are just triples of signed integers. Is there a data structure for this?

Of course there is! I'm not sure what to call it, though; I'm calling it a `spatial_array` in code, but it really is a multidimensional dynamic array expanding in all directions. Let me explain how it works, step by step.

### Negative indices

The standard dynamic array has indices ranging from 0 to N-1 (inclusive), where N is the size of the array. The problem is that I don't want to assume that the player's starting location is 0; it can be pretty much anything. It could even be negative! In fact, I want to support negative indices in the array.

The solution is relatively simple: store a usual array, with indices from 0 to N-1, but keep track of the origin of this array. The element at position `0` actually corresponds to the key `origin`; element at position `1` corresponds to the key `origin + 1`, and so on up to `origin + N - 1`. Thus, using an array with modified indexing operator lets us represent a range `[origin, origin + N)` of indices, even when `origin` is negative. Here's the oversimplified code:

{% highlight cpp %}
template <typename T>
struct fancy_array
{
    // ... some initialization & resizing code

    T & operator[] (int index)
    {
        return values_[index - origin_];
    }

private:
    std::vector<T> values_;
    int origin_;
};
{% endhighlight %}

### Expanding

Now we have an array that represents a range `[origin, origin + N)` of indices, with `origin` possibly being negative. What if I want to add an element at a position that doesn't fall into this range? Expand the range until it contains the new index!

- If the index is to the right of the range (`index >= origin + N`), multiply the size `N` by two until the new index fits in the range
- If the new index is to the left (`index < origin`), multiply the size `N` by two **and** shift the origin to the left (so that the new end `origin + N` coincides with the old one) until the new index fits

We're reusing that "multiply size by two" idea from classical dynamic arrays to make sure that reallocations occur rarely here. In code:

{% highlight cpp %}
template <typename T>
struct fancy_array
{
    // ... other useful methods

    void expand(int index)
    {
        // need static_cast to signed, otherwise the addition & comparison
        // will implicitly cast to unsigned type of values_.size()
        if (index >= origin_ && index < origin_ + static_cast<int>(values_.size()))
            return;

        if (values_.empty())
        {
            // first expansion: initialize to single element and return
            values_.resize(1);
            origin_ = index;
            return;
        }

        int new_origin = origin_;
        int new_size = values_.size();

        while (index >= new_origin + new_size)
            new_size *= 2;

        while (index < new_origin)
        {
            new_origin -= new_size;
            new_size *= 2;
        }

        std::vector<T> new_values(new_size);
        for (int i = 0; i < values_.size(); ++i)
            new_values[i + (origin_ - new_origin)] = values_[i];

        values_ = std::move(new_values);
        origin_ = new_origin;
    }

private:
    std::vector<T> values_;
    int origin_;
};
{% endhighlight %}

Becoming a bit complicated, but still manageable.

### Multiple dimensions

That's all nice, but I wanted a 3D array, not a 1D one! How do we implement a multidimensional (say, of size NxMxK) array, then?

The obvious choice of simply using an array of arrays (e.g. `vector<vector<T>>` for a 2D one) is bad for numerous reasons:

- Every inner array separately stores its size, despite all their sizes being equal; this is data duplication which is error-prone and just wasteful
- Access by a 2D (i,j) index requires two memory reads: one to read the `values_[i]` and figure out its internal pointers, one to finally get to `values_[i][j]`; the second memory read depends on the result of the first, so they can't be executed in parallel (the same applied to 3D arrays with 3 memory reads)
- Iteration is fine (mostly cache-friendly, except at times when you switch to the next inner array), as long as you do it in the right order: e.g. `for (i:0..N) for (j:0..M) values_[i][j];` is order of magnitude faster than `for (j:0..M) for (i:0..N) values_[i][j];`
- Resizing is bad: you need to separately resize each of the inner arrays, meaning a separate allocation for each of them (a ton of smaller allocations isn't typically faster than a single large one in this case)

So far, so good. The alternative is to store all the elements of a, say, 2D NxM array in a single array of size NxM and to compute the proper index at access time:

{% highlight cpp %}
template <typename T>
struct array_2d
{
    // ... some initialization & resizing code

    // using operator() because operator[] cannot have
    // multiple arguments in C++
    T & operator() (int i, int j)
    {
        return values_[i + width_ * j];
    }

private:
    std::vector<T> values_;
    std::size_t width_, height_;
}
{% endhighlight %}

With this layout:
- No data duplication (technically, the `values_` field still stores its size, but we can replace it with `std::unique_ptr<T[]>` or similar)
- Element access is just one memory read (technically, we also need to read the `values_` pointer and `width_` value; however, both these are regular class members and you'll probably already have them on the stack / in cache / in registers / etc)
- Iteration is as good as it gets (just traverse the whole flat array), although `for(i) for(j)` and `for(j) for(i)` still have **very** different performance (thus, it's a good idea for such a class to provide a [range interface](https://en.cppreference.com/w/cpp/language/range-for) that implements the right iteration order)
- Resizing is fine: we'd need one reallocation and some careful code to copy old values to new places

For a 3D version, you'd need to store three sizes, and index computation is a bit more involved:

{% highlight cpp %}
    T & operator() (int i, int j, int k)
    {
        return values_[i + width_ * (j + k * height_)];
    }
{% endhighlight %}

### Putting it all together

So, how do we make an auto-expanding in all directions 3D array?

- Store elements in a flat array
- Store the size of the array along each dimension (3 integers)
- Store the origin of the array along each dimension (3 integers)
- When inserting a new index, expand the array (the size and/or the origin, in each dimension independently) as needed (don't forget to copy old values to new places in the new array)
- When accessing by 3D index, subtract the origin, then use the formula above for a flat 3D array

I won't put the code here, for it gets pretty large (but still not that complicated) here. You can find my implementation [here](https://bitbucket.org/lisyarus/psemek/src/master/libs/util/include/psemek/util/spatial_array.hpp) (although it isn't strictly a single-header library, it doesn't have a lot of dependencies). It actually support arbitrary number of dimensions (specified at compile-time), thanks to some C++ template trickery. The "multidimensional array" part, without auto-expansion and support for negative indicies, is extracted into a separate class [here](https://bitbucket.org/lisyarus/psemek/src/master/libs/util/include/psemek/util/array.hpp) (which I'm also using for all sorts of N-D arrays, like images or 2D bitmasks).

This data structure comes with its problems, as well. You might have also noticed that this doesn't behave as a traditional "set" data structure: when you insert an index, a lot of other indices get implicitly inserted as well upon expansion. This can be solved either by storing `optional<T>`, or by using some sentinel value to indicate absence of value (`nullptr` / `UINT_MAX` / etc). I'm actually storing map chunks by `unique_ptr`, so a null pointer indicates no chunk.

Probably most importantly, this structure doesn't work well when you store some heavy, complex, expensive objects, due to huge amount of potentially unused space. It is also bad in case your indices are sparse, for the same reason. As I've said, in my case I'm storing just pointers, and I have good reasons to believe the used indices are pretty dense (would be a good idea to check that, though!).

So, by replacing a few terrain chunk hash maps with this fancy array, I reduced the time of chunk traversal from 1ms down to about 50μs (about 20x speedup), and the whole frame time from 3ms to 2ms, while the array itself takes about 1Mb of memory (it's just pointers to actual terrain chunks, remember?). I'd say it's a win! Of course, this structure is far from ubiquitous, and quad/octrees or hash tables might work much better in your particular case, but I guess it's still worth knowing. Anyway, hope this was helpful in some way for you, and thanks for reading.
