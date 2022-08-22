---
layout: post
title:  "C++ behavior trees library design"
date:   2022-08-22 10:00:00 +0300
categories: programming
---

### Game AI

Programming game AI is hard. Like, really hard. When dealing with hard problems, humans usually try to come up with patterns, frameworks, guidelines, that help minimize errors and keep the cognitive load at a manageable level. In the case of game AI there are (apart from the obvious *"no pattern"* pattern) many popular choices: state machines, hierarchical state machines, utility systems, behavior trees, and others.

They all have their pros and cons; I won't talk about these here, mainly for the reason that I have zero experience with most of these. See [these](https://www.youtube.com/watch?v=G5A0-_4dFLg) [two](https://www.youtube.com/watch?v=5ZXfDFb4dzc&t=2413s) streams by [Bobby Anguelov](https://twitter.com/Bobby_Anguelov) about these patterns and what types of AI each of them is good for. See also [this](http://www.gameaipro.com/) huge collection of articles on game AI.

Among all the AI patterns, behavior trees seemed most appealing to me, for a number of reasons:
- They are quite popular, meaning there are established best practices to learn and many implementations to be inspired by
- They are naturally hierarchical, which is good for my little monkey brain
- They are quite performant, with a lot of optimization oppotunities
- They sound like a good programming excercise *(yes, I'm the reinvent-the-wheel type of person)*

So, I decided to try this approach and, naturally, to design my own implementation from scratch.

*Why make my own library, if there are already good implementations available? The answer is the same as to why I'm making my own game engine in the first place: it's interesting, it's fun, it's a tremendeously valuable exprience, and I simply enjoy doing this.*

### Behavior trees

*Thie next few sections are more or less an introduction to behavior trees; feel free to skip to "Design goals" if you think you already know all that.*

To begin with, what even are behavior trees? The idea goes roughly like this:
- A single AI entity is represented as a tree of nodes
- Nodes do stuff, with only one node being active (doing it's stuff) at a time
- Leaf nodes typically do concrete stuff, like cutting down a tree or navigating to the next path node
- Inner (non-leaf) nodes typically do aggregation, like retry the child node 3 times until it succeeds, or run all the child nodes sequentially

So, you implement some concrete nodes for your specific AI needs, combine them somehow using generic aggregation nodes (hopefully provided by your behavior trees library) and you have your tree ready to go.

The crucial thing about AI is that it is **asynchronous**: you can't just call it once and call it a day, you need to continuously run it. Coroutines or fibers would be perfect for this, but they are close to impossible to serialize (save & load) in a cross-platform way and hard to control precisely. Thus, behavior tree implementations usually use a tick-based approach, in some sense creating explicit coroutines: each behavior tree node has an `update()` function, and every frame (or every N frames) of game simulation the current active node's `update()` is called. The `update()` may have some `float dt` parameter so that the node knows how much time elapsed from the previous update. Inner tree nodes' `update()` can call their children's `update()` and returns something based on what their children's status was.

To communicate with the rest of the tree, the node must be able to tell it's status: is it still running its stuff, or has it succeeded in doing its stuff, or has it failed? We can achieve this by simply returning this status from the update function.

So, putting all this together, a typical behavior tree node is a class that looks something like this:

{% highlight cpp %}
enum class status
{
    running,
    success,
    failure,
};

struct node
{
    status update(float dt)
    {
        // do stuff and return status
    }

    // ...
};
{% endhighlight %}

A concrete node for, say, cutting down a tree may look like this:

{% highlight cpp %}
struct cut_tree_node
{
    status update(float dt)
    {
        if (!tree_.valid())
        {
            // the tree is gone! maybe it was burned, or
            // someone has already cut it down
            return status::failure;
        }

        tree_.health -= woodcutter_.cutting_speed * dt;
        if (tree_.health < 0.f)
        {
            woodcutter_.inventory.add_resources(tree_.resources);
            tree_.remove();
            return status::success;
        }

        return status::running;
    }

private:
    entity tree_;
    entity woodcutter_;
};
{% endhighlight %}

and an aggregate node that runs all child nodes sequentially might look like this:

{% highlight cpp %}
struct sequence_node
{
    status update(float dt)
    {
        if (current_index_ == children_.size())
        {
            current_index_ = 0;
            return status::success;
        }

        status result = children_[current_index_].update(dt);
        if (result == status::running)
        {
            // the child node is still running; thus, we are running as well
            return status::running;
        }
        if (result == status::failure)
        {
            // the child node has failed; thus, the whole sequence has failed
            return status::failure;
        }

        // the child succeeded; thus, we proceed to the next child and say that we still have work to do
        ++current_index_;
        return status::running;
    }

private:
    std::size_t current_index_ = 0;
    std::vector<node> children_;
};
{% endhighlight %}

You can see that such a simple idea of running a set of actions sequentially already takes quite a handful of code to implement. This is not a downside of behavior trees specifically, though: running a sequence of asynchronous, potentially failing actions is not as simple as you might think! The strength of behavior trees comes in part from this separation & reusability of generic aggregate nodes. I'll list a few of them:

- `sequence` node, which runs all children in sequence and succeeds if **all** children succeeded
- `selector` node, which runs all children in sequence until **at least one** of them succeds (otherwise, the node fails)
- `retry` node, which runs it's child node until it succeds (and ignores all it's failures; *that would be a great trait for a parent/teacher, huh?*)
- `repeat` node, which runs it's child node while it succeds (and stops once it fails)
- `success` node, which runs it's child until it finishes (successfully or otherwise), and reports that it succeeded
- `failure` node, which runs it's child until it finishes (successfully or otherwise), and reports that it failed
- `negate` node, which runs it's child until it finishes, then negates the child's result (reports success if the child failed, and vice versa)
- `forever` node, which simply runs it's child forever, ignoring it's status (useful for e.g. the root of the tree if your AI should be active non-stop)
- `nop` node, which does nothing (may be useful as a fake child to other aggregate nodes)

You might notice that the `forever(child)` node can be implemented as `retry(failure(child))` or `repeat(success(child))`. This compositional strength is probably what caught my eye with behavior trees in the first place. We can, for example, create a `repeat_until(condition, child)` generic node that returns success if the condition node returns success, otherwise it calls the child node and reports failure if it fails:

```
repeat_until(condition, child) =
    sequence(
        repeat(
            sequence(
                child,
                negate(condition)
            )
        ),
        condition
    )
```

- If the `child` node succeeds, we check for condition:
  - If it is satisfied, the `condtion` node returns success, the `negate` node returns failure, the inner `sequence` node returns failure, and the `repeat` node stops repeating (i.e. calling the inner `sequence` node)
  - If it is not satisfied, the `condtion` node returns failure, the `negate` node returns success, the inner `sequence` node returns success, and the `repeat` node continues calling it's child (the inner `sequence` node)
- If the `child` node fails, the inner `sequence` node returns failure, and the `repeat` node stops repeating
- After the `repeat` node stops, we check for the condition again, and the root `sequence` node returns whatever the second `condition` node returned:
    - If the condition is satisfied, we are done and return success
    - If it isn't satisfied, the `child` node must have returned failure (otherwise the `repeat` would've still been repeating), and we return failure

All this might seem convoluted and definitely takes some time to get used to. However, composing simple to test atomic & aggregate nodes is way less error-prone than coding everything from scratch, and is arguably way more readable.

Note, however, that this implementation of `repeat_until` doesn't handle the situation when `child` failed but the `condition` is still somehow satisfied: it returns success in this case. This may be the desired behavior or it may not be. This example highlights a certain problem with behavior trees which tends to come up every now and then: there's no simple way to communicate nontrivial information across the tree (e.g. from a child's child to the root, etc) -- a problem that would probably not arise in e.g. state machines. I never said behavior trees are perfect, did I? In this particular case, we could just implement the `repeat_until` node from scratch, though, and make it work exactly as we want it to.

### Starting a node

For many nodes, it is quite useful to know that a certain `update()` call is the first one since this node has last finished executing, i.e. that this node is just **starting** to run, to prepare/fetch some useful data, check some conditions, etc. There are two approaches to managing that:

- Each node tracks explicitly whether it has already finished or not; if an `update()` is called and the node has finished, it means the node is started running again
- Have an explicit `start()` method for each node which gets called when the node is, well, started

The downside of the first approach is that you have to duplicate this logic in every node that needs it. The downside of the second approach is that all generic aggregate nodes must carefully implement calling their children's `start()` method in appropriate times.

For no particular reason, I've chosen the second approach, meaning the interface of a node becomes

{% highlight cpp %}
struct node
{
    void start();
    status update(float dt);
};
{% endhighlight %}

### Waiting

Let's upgrade our `status` enum with a new value: `waiting`. This value should also come with a time period, like `waiting(1.5f)` meaning wait for 1.5 seconds. Semantically, this status is the same as `running`, but with an explicit hint that the node can be assumed to still be running for this amount of time (at least). The cool thing is that if the tree returns `waiting` status, we can **skip all updates to it entirely** for that duration, because we already know that it will still be running! This is a nice optimization, since AI is usually quite computationally heavy, and even traversing the tree all the way down to the node that is currently active and checking that it's still just running comes at a cost.

We can actually do much more: store all the `waiting` nodes in a [priority queue](https://en.wikipedia.org/wiki/Priority_queue), sorted by the time at which they need to be woken up. At each new AI update tick, we only call `update()` for non-waiting nodes, and also "wake up" the nodes whose time has come to be woken up (which is fast thanks to the priority queue). This way, you can not only skip calling the `update()` for waiting nodes, but you can **skip iterating over them**! This is a huge optimization, since, if done right, most of the time most of the AI agents will be just waiting for something. Moving to the next path node? Takes at least `distance / speed` time, so the AI just waits (actual movement & animation should be governed by some lower-level systems, not AI). Cooking a meal? Takes `cooking_time` time; wait for that long. Wandering around? Stop and wait for a random time period to make it look like you're admiring the view. I've found that even in a system with a few hundred agents, only a few (3-5) of them are actually active at a certain update; others are waiting!

Now, this `waiting` status can't be just another `enum` value, since it comes with a time duration value. We could do something like


{% highlight cpp %}
struct status
{
    enum {
        running,
        success,
        failure,
    } status;
    float duration;
};
{% endhighlight %}

But it's 2022 already and C++ has standard sum types, so I'm doing it like this (also merging the `success` and `failure` states together):

{% highlight cpp %}
struct running{};

struct finished
{
    // true for success, false for failure
    bool result;
};

struct waiting
{
    float duration;
};

using status = std::variant<running, finished, waiting>;
{% endhighlight %}

Some behavior tree implementations can have more status values. For example, some have an `idle` status, meaning this node isn't running at all. I simply consider calling an `update()` for a node that wasn't started a programming error; this might sound harder to debug, but honestly I haven't found any issues with this whatsoever *(or maybe I'm misunderstanding the `idle` status? Who knows)*.

### Events

The final touch for our behavior tree node interface is responding to events. Say, your poor AI is cutting down a tree, while suddenly it spots an angry woolf nearby. It better run away, or prepare to fight! 

How do we implement this in a behavior tree? Surely we could simply check for **all** such conditions in the beginning of **every** node's `update()` methods (or maybe just the leaf nodes). Needless to say, this is ridiculously wasteful, and doesn't work at all in the presence of the `waiting` optimization we talked above.

A much nicer way is to make the nodes explicitly respond to events: have an `on_event()` method that gets the event that happened and decides what to do:

{% highlight cpp %}
struct node
{
    void start();
    status update(float dt);
    void on_event(event);
};
{% endhighlight %}

On a certain event, a node may e.g. record that it needs to fail at the next update, or something like that. We also have to immediately wake up a `waiting` node when an event happens, of course.

### Design goals

So, what do I want from my implementation of a generic, reusable behavior trees library? Quite a lot, to be honest:
- **Arbitrary time type.** `float` is nice, but what if I'm making a roguelike with discrete equal time steps, and I want to use an integer for time? Or maybe I'm doing some nanorobots simulation and I have to use `double` not to lose precision? Or maybe I've gone completely bonkers and my time is a `complex` number or a `string`? *There definitely are use-cases for that, I promise!*
- **Arbitrary event type.** This one is way less speculative than the time type -- how does a generic library know anything about the specific AI event types? Ideally I'd like the `event` type to be a variant of all possible event types specific to this particular AI, or something like that.
- **Arbitrary extra parameters for `update()`.** A specific behavior tree runs for a specific agent; it needs access to this agent's data, as well as to some world data like buildings and pathfinder. These could go to the node's constructor, so that it would save them as members and access at any time. A much more flexible and memory-cheap approach is to put them directly to the `update()` method parameters at each update: this way, we can change the pathfinder or even the entity this tree controls, and it still should work (in theory)!
- **Readable [DSL](https://en.wikipedia.org/wiki/Domain-specific_language)-like tree description.** Look at the `repeat_until` implementation above: wouldn't it be neat if this is what it actually looked like, in code? Instead of explicitly creating compound nodes as separate classes with a ton of boilerplate, we'd just write a nice behavior tree (or part of it) directly in code, with a readable & understandable syntax.

With these goals in mind, I proceeded to design this library.

### First attempt

Being such a C++ templates admirer, my first idea was to use the full power of compile-time ad-hoc polymorphism this language provides, and make each behavior tree node a separate (most probably, a template) class with the interface outlined above, with no virtual methods:

{% highlight cpp %}
template <typename Time, typename Event, typename ... Args>
struct node
{
    void start(Args ... args);
    status update(Time dt, Args ... args);
    void on_event(Event event, Args ... args);
};
{% endhighlight %}

When implementing, say, the `repeat` node, we also have to add the child's type to the template parameters:

{% highlight cpp %}
template <typename Child, typename Time, typename Event, typename ... Args>
struct repeat
{
    Child child;

    void start(Args ... args);
    status update(Time dt, Args ... args);
    void on_event(Event event, Args ... args);
};
{% endhighlight %}

and the `sequence` node would be parametrized by the types of all it's children:

{% highlight cpp %}
template <typename ... Children, typename Time, typename Event, typename ... Args>
struct sequence
{
    std::tuple<Children...> children;

    void start(Args ... args);
    status update(Time dt, Args ... args);
    void on_event(Event event, Args ... args);
};
{% endhighlight %}

Now, the children types can be easily deduced thanks to C++17 [class template argument deduction](https://en.cppreference.com/w/cpp/language/class_template_argument_deduction), but we still have all the other template parameters, and argument deduction can either deduce all or deduce nothing. Even if we could omit the children types, it would be a nightmare to have to write code like

{% highlight cpp %}
sequence<float, event, entity_id, ai_context>(
    repeat<float, event, entity_id, ai_context>(
        ...
    ),
    ...
)
{% endhighlight %}

We clearly need a way to deduce all this parameters as well. I've actually found a nice solution later, which I discuss below in the "Second attempt" section, but at the time I only managed to come up with this:

- Make a class called `behavior_tree` which is parametrized by all the common types (`Time, Event, Args...`)
- Implement all the generic aggregate nodes as inner classes within this main class; they implicitly have all the template parameters of the parent

It looked roughly like this:

{% highlight cpp %}
template <typename Time, typename Event, typename ... Args>
struct behavior_tree
{
    template <typename Child>
    struct repeat
    {
        Child child;

        void start(Args ... args);
        status update(Time dt, Args ... args);
        void on_event(Event event, Args ... args);
    };

    template <typename ... Children>
    struct sequence
    {
        std::tuple<Children...> children;

        void start(Args ... args);
        status update(Time dt, Args ... args);
        void on_event(Event event, Args ... args);
    };
};
{% endhighlight %}

Now, to actually use it, you have to **inherit** the `behavior_tree` with the required types, and implement **all of your AI** inside that derived class:

{% highlight cpp %}
struct human_behavior_tree
    : behavior_tree<float, event, entity_id, ai_context>
{
    static auto follow_path()
    {
        return sequence{
            repeat{
                ...
            },
            ...,
            ...
        };
    }
};
{% endhighlight %}

So, you'd implement leaf nodes as classes within the `human_behavior_tree` class, and compound nodes are constructed via static methods. Here's an actual snippet from a project where I tested this approach on:

{% highlight cpp %}
static auto do_catch_fish()
{
    return sequence{
        log("Catching fish"),
        ensure_instrument(item::fishing_rod),
        condition{[](world * w, int id){
            auto & h = w->humans[id];

            auto p = w->closest_water(h.position);
            if (!p)
                return false;

            h.target_tile = *p;
            return true;
        }},
        find_path{false},
        follow_path(),
        wait{[](world * w, int){ return random::uniform(w->rng, FISH_CATCH_INTERVAL); }},
        condition{[](world * w, int id){
            auto & h = w->humans[id];

            h.left_hand = item{item::fish};

            return true;
        }},
    };
}
{% endhighlight %}

Amusingly, it actually works! The benefits of this approach are:
- The whole tree is a single enormous object without any pointers to children (they are just class members!), so the allocator & cache are quite happy
- Everything is known at compile-time, meaning the compiler has all the opportunities to optimize, inline, and other magic

Unfortunately, it also has a number of downsides:
- Everything is known at compile time. I can't replace part of the tree somewhere mid-game, I can't make a mod that e.g. replaces just a single part of the tree with a different implementation.
- You have to declare everything in a single class in a single file. C++ doesn't support splitting a class definition across multiple files; and we need this single class to overcome that type deduction problem I mentioned before *(as I've said, I've actually found a better solution for this particular problem)*
- The whole behavior tree takes approximately forever to compile
- I'm relying on **deducing template arguments for a class which is nested within another template class**. C++ being C++, this is actually a **defect in the standard**, meaning it isn't clearly specified how this should work. [Clang fails to compile](https://bugs.llvm.org/show_bug.cgi?id=35107) this and it will do so until the defect is resolved. This can be fixed by manually adding deduction guides, which in turn [breaks under GCC](https://gcc.gnu.org/bugzilla/show_bug.cgi?id=79501) and this isn't going to be fixed either, due to the very same defect (without deduction guides, GCC compiles this happily, -- this is why I managed to actually use this approach on a test project for quite a while).

[Here's the source](https://bitbucket.org/lisyarus/psemek/src/master/libs/util/include/psemek/util/behavior_tree.hpp) for this "library". It consists of a single 800-line file (due to having to implement everything inside the `behavior_tree` template class) full of nothing but templates.

The disadvantages of this approach are quite serious, so I decided to abandon it, together with the test project.

<center><img src="{{site.url}}/blog/media/behavior_trees/first.gif"></center>
<center><i>Poorly drawn hoomans cutting down poorly drawn trees</i></center>
<br/>

### Second attempt

All this was somewhere in November 2021. Fast-forward to June 2022, I'm once again working on something with agents doing their typical AI stuff like navigating and building *(and I'm much more determined this time, I promise!)* So, I decided to give behavior trees another try.

First, remove the child-nodes-as-template-parameters nonsense. Make it an actual interface:

{% highlight cpp %}
template <typename Time, typename Event, typename ... Args>
struct node
{
    virtual void start(Args ... args) = 0;
    virtual status update(Time dt, Args ... args) = 0;
    virtual void on_event(Event event, Args ... args) = 0;
};
{% endhighlight %}

Now, actual nodes implement this interface, are be stored by pointers (or, better, `unique_ptr`), and created dynamically. We still have the problem deducing the template parameters, though!

That's when it occurred to me that an aggregate node can easily deduce all the tree's template parameters from its child nodes! We'll only have to specify them for leaf nodes, which is not perfect but still bearable. To make things easier, I made something like a **traits** class that only stores these types:

{% highlight cpp %}
template <typename Time, typename Event, typename ... Args>
struct tree
{
    using time_type = Time;
    using event_type = Event;
    using args_type = std::tuple<Args...>;
};
{% endhighlight %}

Now I can specify the types of a specific AI tree like this:
{% highlight cpp %}
using droid_ai = tree<float, event, ai_context, entity_id>;
{% endhighlight %}

and use this `droid_ai` type whenever I need to refer to this particular setup of a behavior tree.

Next, all the behavior tree library templates depend not on the types `Time, Event, Args...` themselves, but on this **traits** type, and use partial specialization:

{% highlight cpp %}
template <typename Tree>
struct node;

template <typename Time, typename Event, typename ... Args>
struct node<tree<Time, Event, Args...>>
{
    struct running
    {};

    struct finished
    {
        bool result;
    };

    struct suspended
    {
        Time duration;
    };

    using status = std::variant<running, finished, suspended>;

    virtual void start(Args ...) = 0;
    virtual status update(Time dt, Args ... args) = 0;
    virtual bool event(Event const &, Args ...) = 0;

    virtual ~node() {}
};

template <typename Tree>
using node_ptr = std::unique_ptr<node<Tree>>;
{% endhighlight %}

Now, to refer to the base node type for droids, I don't have to type `node<float, event, ai_context, entity_id>`, I just say `node<droid_ai>`, and I think it's beautiful.

Finally, to make aggregate nodes work, I make special constuctor-like functions that help deduce the **traits** type:

{% highlight cpp %}
template <typename Tree>
struct repeat_node;

template <typename Time, typename Event, typename ... Args>
struct repeat_node<tree<Time, Event, Args...>>
    : node<tree<Time, Event, Args...>>
{
    // ...
};

template <typename Tree>
node_ptr<Tree> repeat(node_ptr<Tree> child)
{
    return std::make_unique<repeat_node<Tree>>(std::move(child));
}
{% endhighlight %}

And that's it! Implementing generic nodes is still quite a handful of boilerplate (although this time each of them can live in it's own file), but using them is a breeze. Here's the code for the node that tries to find resources required for a droid's task (`bt` is the behavior tree library namespace):

{% highlight cpp %}
bt::node_ptr<droid> get_task_resources()
{
    return
        bt::sequence(
            fill_task_required_resources(),
            can_find_task_resources(),
            bt::selector(
                task_required_resources_empty(),
                bt::success(
                    bt::sequence(
                        fill_unload_resources_task(),
                        unload_inventory()
                    )
                )
            ),
            bt::repeat(
                bt::sequence(
                    bt::negate(task_required_resources_empty()),
                    bt::selector(
                        select_task_resources_container(),
                        bt::failure(mark_task_unsupported())
                    ),
                    wait_for_path(),
                    follow_path(),
                    do_get_task_resources(),
                    wait(interaction_time)
                )
            ),
            task_min_required_resources_empty()
        );
}
{% endhighlight %}

And here's a leaf node that waits for a specific time duration, using the generic `bt::wait` library node (note that `<droid>` is enough to specify the tree type):

{% highlight cpp %}
bt::node_ptr<droid> wait(float duration)
{
    return bt::wait<droid>([=](droid_context const &, util::ecs::entity_handle){
        return duration;
    });
}
{% endhighlight %}

Pretty neat, I'd say! We've lost the cache and allocator-friendliness, though we could restore them by supplying our own allocator for the whole tree. We've also lost the possibility for heavy inlining, which we can't really do anything about. Having used this for quite a while by now and I'd say that it is a pretty good approach, and seems to handle most complicated situations relatively well. [Here's the source code](https://bitbucket.org/lisyarus/psemek/src/master/libs/bt/include/psemek/bt/) for this second approach. It is pretty much self-contained.

<center><video width="600" autoplay muted loop><source src="{{site.url}}/blog/media/behavior_trees/second.mp4" type="video/mp4"></video></center>
<center><i>AI droids doing their stuff. Most of them got stuck trying to pick up resources from a container on the right, but they did it consciously!</i></center>
<br/>