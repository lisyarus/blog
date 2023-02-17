---
layout: post
title:  "Super simple generic animation controller in C++"
date:   2023-02-17 16:00:00 +0300
categories: programming
---

Recently I've been adding some animations to my current project, like appearing buildings and cars:

<center><video width="100%" autoplay muted loop><source src="{{site.url}}/blog/media/animation/cars_buildings.mp4" type="video/mp4"></video></center>

and I found myself in need of some sufficiently generic thing that could do all the animation updating boilerplate, so I figured I'd share what I've come up with.

# What is an animation controller?

Whatever you want, really, but in my case I needed something like this: a class that I can use to

* Add new animations, specifying their duration
* Update existing animations
* Remove finished animations

Updating is the most important part from the design point of view. Should an animation implement some interface with e.g. an `update(float dt)` method? In all my use cases this looked like too much of a burdern. Even if we replace an interface with a callable object as a template parameter, we'd have to create this callable object explicitly instead of writing a lambda because it's inconvenient to parametrise a template with a lambda, and this object would have to carry a lot of extra content (the closure of the lambda), etc. All this sounds a bit too heavy and boilerplate-ish.

# The design

Let's flip this upside down: the animation controller updates the animation state, but doesn't know what to do with it - this will be the user's job. Something like this:

{% highlight cpp %}
animation_controller.update(delta_time);
for (auto const & animation : animation_controller)
    do_something_with(animation.elapsed_time);
{% endhighlight %}

This way, the controller doesn't need to do any extra logic apart from managing the animations themselves. However, how does the user know what does each animation mean? We need to supply it with some extra data:

{% highlight cpp %}
animation_controller.update(delta_time);
for (auto const & animation : animation_controller)
    do_something_with(animation.elapsed_time, animation.data);
{% endhighlight %}

For example, this `data` can be an ID of a building instance that needs updating its Z-coordinate, or an ID of a car that needs updating its scale.

Now, adding a new animation should be as simple as

{% highlight cpp %}
animation_controller.add(duration, new_data);
{% endhighlight %}

The `update` method then simply adds `dt` to each animation's elapsed time, and removes the finished animations.

# The implementation

Implementing this thing is pretty straightforward, unless you want the update to be fast enough. Let's sketch the code:

{% highlight cpp %}
template <typename Time, typename Data>
struct animation_controller
{
    void add(Time duration, Data && data);
    void update(Time delta);

    ??? begin() const;
    ??? end() const;
}
{% endhighlight %}

The `begin-end` pair is here to enable iterating over the active animations.

*A template Time parameter? Are you mad?* Well, first of all yes I am, secondly I see no reason not to do it like this: maybe I'm using this thing in a discrete, turn-based setting, where `Time` is actually an integer. Or maybe it's some UI which is based on `std::chrono`, and its time is represented as `std::chrono::seconds`. The whole class will end up being less than a few dozen lines, and a simple template parameter won't make it worse.

So, we need to store animations & iterate over them, let's get this done:

{% highlight cpp %}
template <typename Time, typename Data>
struct animation_controller
{
    struct animation
    {
        Time elapsed_time;
        Time duration;
        Data data;
    };

    void add(Time duration, Data && data)
    {
        animations_.push_back({Time(0), duration, std::move(data)});
    }

    void update(Time delta);

    auto begin() const { return animations_.begin(); }
    auto end() const { return animations_.end(); }

private:
    std::vector<animation> animations_;
}
{% endhighlight %}

Notice that the `begin-end` methods are marked `const` so that the user cannot modify an existing animation.

# Updating the animations

Now to the fun part. How do we update the animations? First of all, we need to update the `elapsed_time`:

{% highlight cpp %}
void update(Time delta)
{
    for (auto & animation : animations_)
        animation.elapsed_time += delta;

    ...
}
{% endhighlight %}

Then, we need to remove finished animations, i.e. animations such that `elapsed_time >= duration`. We could do this while we're updating them, somethiong like

{% highlight cpp %}
void update(Time delta)
{
    for (auto & animation : animations_)
    {
        animation.elapsed_time += delta;
        if (animation.elapsed_time >= animation.duration)
            // remove it
            ...
    }
}
{% endhighlight %}

However, this wouldn't be branch-predictor friendly. Let's remove them after updating the time:

{% highlight cpp %}
void update(Time delta)
{
    for (auto & animation : animations_)
        animation.elapsed_time += delta;


    for (auto const & animation : animations_)
        if (animation.elapsed_time >= animation.duration)
            // remove it
            ...
}
{% endhighlight %}

Now it would be cool if we could store the animations in some smart way so that we could find the finished animations faster than via a linear search, while still storing them all in a contiguous array to make the cache happy. One way is to keep the animations sorted with respect to *remaining time* (i.e. `duration - elapsed_time`). This way, we need to remove only elements with `remaining_time <= 0`, which will be in the beginning of the array:

{% highlight cpp %}
while (!animations_.empty() && animations_.front().remaining_time() <= 0)
    // remove animations_.front()
{% endhighlight %}

However, removing an element from the beginning of `std::vector` is bad: we'll have to shift all other elements to the left. Let's instead keep the elements sorted by *decreasing* `remaining_time`: this way, all to-be-removed elements will be at the end:

{% highlight cpp %}
while (!animations_.empty() && animations_.back().remaining_time() <= 0)
    animations_.pop_back();
{% endhighlight %}

Great! Notice that updating the animations (the `+= dt` thing) doesn't change the ordering (if we neglect floating-point errors, that is...).

However, we also need to maintain this ordering when adding a new animation: we can find the proper place to put the animation to with `std::lower_bound` in `O(log n)` time, but actually adding it will still take `O(n)` time because we'll need to shift all animations after the new one to the right (that's what `std::vector::insert` will do). Is there a better way?

# Heaps!

Notice that sorting does a bit more than we need: we don't care about the ordering of all elements, we only want the smallest one (i.e. the one with the smallest `remaining_time`). There's a data structure with exactly this purpose: a [binary heap](https://en.wikipedia.org/wiki/Binary_heap).

Here's a TL;DR of binary heaps:

* Logically, it is a binary tree
* Every child node has value larger than its parent
* Therefore, the root is always the smallest element
* Adding a new element and removing the smallest element take `O(log n)` time
* It doesn't need dynamic allocation of nodes as most trees do, instead it can be packed in a single array, with the root being the *first* element of the array

C++ has all the required machinery in the `<algorithm>` header in the form of `std::*_heap` functions. (It also has `std::priority_queue` which has a somewhat dumb interface, so I don't usually use it).

First, to add an element to the heap, we need `std::push_heap` which takes the *last* element of an array and inserts it into a a heap stored in *all but the last* elements:

{% highlight cpp %}
void add(Time duration, Data && data)
{
    animations_.push_back({Time(0), duration, std::move(data)});
    std::push_heap(animations_.begin(), animations_.end(), heap_compare{});
}
{% endhighlight %}

We'll talk about `heap_compare` in a minute.

Next, to retrieve the minimal element, we use `std::pop_heap`, which removes the minimal element (i.e. the first element of the array) by placing it to the *last* position in the array, and rearranging the remaining elements so that they form a heap:

{% highlight cpp %}
while (!animations_.empty() && animations_.front().remaining_time() <= 0)
{
    std::pop_heap(animations_.begin(), animations_.end(), heap_compare{});
    // animations_.front() was moved to animations_.back()
    animations_.pop_back();
}
{% endhighlight %}

Finally, what's `heap_compare`? It is a comparator which will be used to compare our elements. Standard C++ heap is a *max-heap*, meaning it maintains the *largest* instead of the *smallest* element, so we'll have to reverse the ordering manually in the comparator (i.e. `compare(x,y)` will tell if `x` is *greater* than `y` instead of telling if it's *less*):

{% highlight cpp %}
struct heap_compare
{
    void operator()(animation const & a1, animation const & a2) const
    {
        return a1.remaining_time() > a2.remaining_time();
    }
};
{% endhighlight %}

*Why make a comparator instead of a lambda? Mostly because we'll need it in two places (in `add` and `update`). We could as well make a function with deduced return type which returns this lambda. Either way, it's almost the same amount of code and exactly the same generated assembly.*

*Why make a comparator/lambda instead of `operator <` ? Well, one animation isn't objectively smaller or greater than the other, we're merely comparing them to arrange in a certain data structure, so I feel like an explicit comparator communicates the intent better.*

# The full code

And that's it! Here's the full code of this class:

{% highlight cpp %}
template <typename Time, typename Data>
struct animation_controller
{
    struct animation
    {
        Time elapsed_time;
        Time duration;
        Data data;

        Time remaining_time() const
        {
            return duration - elapsed_time;
        }
    };

    void add(Time duration, Data && data)
    {
        animations_.push_back({Time(0), duration, std::move(data)});
        std::push_heap(animations_.begin(), animations_.end(), heap_compare{});
    }

    void update(Time delta)
    {
        for (auto & animation : animations_)
            animation.elapsed_time += delta;

        while (!animations_.empty() && animations_.front().remaining_time() <= 0)
        {
            std::pop_heap(animations_.begin(), animations_.end(), heap_compare{});
            animations_.pop_back();
        }
    }

    auto begin() const { return animations_.begin(); }
    auto end() const { return animations_.end(); }

private:
    std::vector<animation> animations_;

    struct heap_compare
    {
        void operator()(animation const & a1, animation const & a2) const
        {
            return a1.remaining_time() > a2.remaining_time();
        }
    };
}
{% endhighlight %}

# Final touches

I've found it useful to make the `animation` tell it's normalized time, i.e. `elapsed_time / duration`, which is a number in [0, 1] and can be used as an interpolation parameter in spline, easing functions, etc:

{% highlight cpp %}
struct animation
{
    Time elapsed_time;
    Time duration;
    Data data;
    
    Time remaining_time() const
    {
        return duration - elapsed_time;
    }
    
    Time position() const
    {
        return std::clamp(elapsed_time / position, Time(0), Time(1));
    }
};
{% endhighlight %}

The `clamp` here is debatable, though.

What if I want to know which animations have finished, exactly? Easy: let's return the list of finished animations' data from the `update` method:

{% highlight cpp %}
std::vector<Data> update(Time delta)
{
    for (auto & animation : animations_)
        animation.elapsed_time += delta;

    std::vector<Data> finished;

    while (!animations_.empty() && animations_.front().remaining_time() <= 0)
    {
        std::pop_heap(animations_.begin(), animations_.end(), heap_compare{});
        // animations_.front() was moved to animations_.back()
        finished.push_back(std::move(animations_.back().data));
        animations_.pop_back();
    }
    return finished;
}
{% endhighlight %}

Now we can do something with them, as well, like maybe removing the car model if its disappearing animation has finished.

# Conclusion

Was it worth it, i.e. is it really faster than a stupidly simpler solution? I don't know, I didn't measure it! At least it should be, in theory. I'll try doing that when I have enough animated objects in the game :)

In the meanwhile, go watch my devlog on a completely unrelated project:
<iframe width="100%" style="aspect-ratio:16/9" src="https://www.youtube.com/embed/GazsE5NDMj8" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe><br/>

Also, I've made a particle simulator recently. It's available <a href="https://lisyarus.itch.io/particle-simulator">here</a> and I'll probably make a video about it as well.
As always, thanks for reading!

<a href="https://lisyarus.itch.io/particle-simulator"><img width="100%" src="https://img.itch.zone/aW1hZ2UvMTg2MzkzNS8xMDk1MTQ2OC5wbmc=/original/CHcTAG.png"></a>