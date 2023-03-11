---
layout: post
title:  "How not to design a UI library"
date:   2023-03-11 14:00:00 +0300
categories: programming
---

<style>

* {
	text-align: justify;
}

</style>

* TOC
{:toc}

*This post is a dive into the design of my UI library in my pet C++ game engine, as well as a lot of rants on what didn't work as well as I'd thought it would :) The library itself is located [here](https://bitbucket.org/lisyarus/psemek/src/master/libs/ui/).*

I've noticed that literally in any project I make there is some kind of UI. Even a keyboard-only game needs some text and a few buttons:

<center><img width="100%" src="{{site.url}}/blog/media/not_ui/astrowind.png"></center>
<div style="text-align: center"><i><a href="https://lisyarus.itch.io/astrowind">AstroWind</a>, my first jam game, made for Brackeys 2020.2</i></div>
<br>

<center><img width="100%" src="{{site.url}}/blog/media/not_ui/trackdizzia.png"></center>
<div style="text-align: center"><i><a href="https://lisyarus.itch.io/trackdizzia">Trackdizzia</a>, my recent racing game made for Ludum Dare 51. It turned out surprisingly decent!</i></div>
<br>

After making a bunch of jam games & random (mostly abandoned) projects, I decided I need a dedicated UI library in my engine.

# Alternatives?

Before I get to the point of the post, let's briefly discuss some existing UI libraries:

* **Qt**

<center><img width="100%" src="{{site.url}}/blog/media/not_ui/qt.png"></center>
<br>

Qt is by far the best high-quality commercial UI library targetting C++. It is also an enormous clusterfuck in terms of how it approaches things. It has a lot of legacy (for a reason --- the first version of the library *predates* the first C++ standard!), requires weird preprocessors for its signals mechanism (at least it supports lambdas here), does weird stuff with OpenGL (like flipping the Y coordinate for the default framebuffer and generally unpredictably altering the GL state), doesn't use modern C++ (raw pointers everywhere!), etc. It also wants to be in control of everything, while I'd like a library that I can seamlessly plug to a project. Not to mention I'll have to bundle petabytes of Qt DLLs with my games :)

<br>

* **ImGUI**

<center><img width="100%" src="{{site.url}}/blog/media/not_ui/imgui.png"></center>
<br>

Dear ImGUI is excellent, but it's targeting tools & not the end user (it says that directly in the description!). I also just don't really buy the immediate mode thing: I want the thing to flawlessly support e.g. tons of complex animations & formatted text, and re-submitting this every frame sounds painful.

*There are also things like wxWidgets, GTK, and a ton of other libraries with some similar issues. I didn't conduct a thorough research into all these; this section is mostly to prevent questions like "but why didn't you just use `library_name`" :)*

# Goals

So I'm making my own UI library in C++, because I <s>love reinventing the wheel</s> have genuinely valid reasons to. Whenever you design a library, you have some end goals in mind (maybe unconciously so). In my case these were:

* **Automatic layout**. This was probably the most important goal: even in a simplest case of window-centered text, it's so nice if it automatically positions itself in the window center and you don't have to write this code manually. Of course, there are much more complicated cases like some floating widget with buttons and text and scrollbars and stuff, all resizing perfectly. This becomes a huge pain without some automation:

<center><video width="100%" controls><source src="{{site.url}}/blog/media/not_ui/merchants.mp4" type="video/mp4"></video></center>
<div style="text-align: center"><i>An unfinished medieval trading game, abandoned largely because of the sheer amount of UI that I couldn't handle anymore.</i></div>
<br>

* **Easy integration**. I usually design all parts of my engine to be extremely decoupled, as self-contained as possible. I should be able to add UI to my project at any point and not have to rewrite everything.
* **Customization**. Naturally, I'd want to use different UI styles for different projects, so I need some way of customizing the appearance of various UI components.
* **Separation of logic and appearance**. Maybe I want to make a button that starts spinning and emitting sparkles when I mouseover it? I should be able to implement it without duplicating all the essential button logic.
* **Performance**. As I've said, I want to use it for ginormously complex user-facing UI's and I want it to behave smoothly.
* **Flexibility**. If I want to make a UI element that flies around the screen as a propelled spacecraft, I should be able to.

# Design

I started prototyping the library some two years ago in a certain map generation project, and then moved it inside my pet engine to continue there.

<center><img width="100%" src="{{site.url}}/blog/media/not_ui/anthropos.png"></center>
<div style="text-align: center"><i>An abandoned map generation project. Gosh I have dozens of these.</i></div>
<br>

I decided to go the old-school, Qt-like OOP-heavy style: you have a base `element` class that everything inherits from, with a ton of virtual methods that you can override to customize your UI element. Something like

{% highlight cpp %}
struct element
{
    virtual void draw() const = 0;

    virtual bool event(mouse_move) = 0;
    virtual bool event(mouse_click) = 0;
    virtual bool event(key_press) = 0;

    virtual box shape() const = 0;
    virtual void reshape(bbox) = 0;

    virtual ~element() {}
};
{% endhighlight %}

This actually worked surprisingly well and was flexible enough, but every time I wanted to add something radically new to the library, the easiest option was to add yet another method to this base class, and after two years it grew [obnoxiously](https://bitbucket.org/lisyarus/psemek/src/master/libs/ui/include/psemek/ui/element.hpp).

The `draw` method doesn't actually draw anything itself, it has a `painter` argument that does the actual drawing, rouhgly like

{% highlight cpp %}
void my_element::draw(painter & p) const
{
    p.draw_rect(0, 0, 100, 100, gfx::red);
    p.draw_text("Ok", 50, 50, gfx::white);
}
{% endhighlight %}

Say, if you want to implement a button class, you make something like

{% highlight cpp %}
struct button : element
{
    void draw() const override;

    bool event(mouse_move) override;
    bool event(mouse_click) override;

    box shape() const override;
    void reshape(bbox) override;

    using callback = std::function<void()>;
    void on_click(callback);

private:
    bool mouseover_ = false;
    bool mousedown_ = false;
    callback callback_;
};
{% endhighlight %}

and then implement all the state logic in the overriden methods. I'll talk about the `shape/reshape` methods a bit later in the article.

The elements form a tree hierarchy: each element has a parent and some (maybe zero) children:

{% highlight cpp %}
struct element
{
    // ...

    element * parent();

    virtual std::span<element *> children() = 0;
};
{% endhighlight %}

This allows implementing layout/container UI elements, like an element that lays out it's children in a horizontal row.

The `span<element *>` interface is an optimization so that the `children()` method needs no allocations (as opposed to returning e.g. and `vector`) and makes no assumptions about how the element stores it's children: via `unique_ptr/shared_ptr`, in a `vector`, or even simply by value. In practice, however, all UI elements are always stored by a `shared_ptr` because I might need to reference them elsewhere (e.g. to update their state from the logic code, to change their style, etc). This means that most container elements need to store their children twice: in a `vector<shared_ptr<element>>` for owning them, and in a `vector<element *>` to implement the `children` method. Horrible.

The `event` methods return a `bool` signifying whether the element did handle the event. When an event occurs (e.g. the user clicks somewhere), the library traverses the element tree bottom-up (from lowest children to the root) and stops when someone handles the event. There are certain conventions like nobody should handle (i.e. return `true` from) the `mouse_move` event, though you can still do that (to intercept the event, i.e. to prevent it from propagating further).

# Customization

To support customizing the appearance of my UI, I introduced the concept of [*styles*](https://bitbucket.org/lisyarus/psemek/src/master/libs/ui/include/psemek/ui/style.hpp). A style is a struct with a bunch of data that controls the appearance, like

{% highlight cpp %}
struct style
{
    std::optional<color> color;
    std::optional<int> border_width;
    std::optional<int> text_size;
    // etc...
};
{% endhighlight %}

All the fields are optional: an empty value means this value comes from the element's parent style. This way, I can set the default style to the UI root element, and override specific values in specific components, like make this particular button red-colored.

However, this would mean that on every `draw()` I'd have to look into the element's style, then look at it's parent style, then the parent's parent, etc up until the root style, to compute the final style of this element. That's way more operations than I'd want a single `draw()` call to do, so I added *style caching*: every element remembers the combined style of itself and the parent's combined style. Phew!

Of course, later I've faced situations where I want to add a specific style to an element *without* propagating it to the children! So, I added another style hierarchy, called `own_style`, and the element uses it's combined `style` and combined `own_style`. This solved the problem but I already felt like all this style-fu is awful :)

*Of course*, later I needed to dynamically update the style. Say, the user changed some apperance settings: now I need a way to tell *all* the UI elements that use this particular style as `style` or `own_style` to recalculate their combined styles. So, I made the style store pointers (`weak_ptr`'s, actually) to all elements using the style, so that I could update it efficiently.

Wtf.

These aren't the only problems with this approach. What if I'm making my own UI implementation (see the next section) with very specific buttons comming from pre-made images, how do I interpret the `border_width` parameter? Do I ignore it completely, or do I try to use it somehow? What if I want some specific style option that only makes sense in this particular implementation of UI elements, do I add it to the `style` struct from the core library? Neither of this makes sense.

Overall, this solution kinda worked, but I'm really not happy with it (even though most UI frameworks seem to be doing something similar).

# Separation of logic and appearance

This part is actually pretty OK in my library. The base library contains implementations of common UI components, like [buttons](https://bitbucket.org/lisyarus/psemek/src/master/libs/ui/include/psemek/ui/button.hpp), [text views](https://bitbucket.org/lisyarus/psemek/src/master/libs/ui/include/psemek/ui/label.hpp), [grid layouts](https://bitbucket.org/lisyarus/psemek/src/master/libs/ui/include/psemek/ui/grid_layout.hpp), [sliders](https://bitbucket.org/lisyarus/psemek/src/master/libs/ui/include/psemek/ui/slider.hpp), etc, but only their core logic. For example, the button tracks whether the mouse is hovering the button and whether it is clicked, and calls the `on_click` callback when appropriate.

However, it doesn't know anything about it's shape and appearance. You're supposed to subclass this base button and implement these things yourself. I introduced a thing called an [*element factory*](https://bitbucket.org/lisyarus/psemek/src/master/libs/ui/include/psemek/ui/element_factory.hpp) --- an interface that allows creating various UI components. It's basically just a bunch of `make_X` methods for every possible component type `X`:

{% highlight cpp %}
struct element_factory
{
    virtual std::shared_ptr<button> make_button() = 0;
    virtual std::shared_ptr<label> make_label() = 0;
    virtual std::shared_ptr<slider> make_slider() = 0;
    // etc
};
{% endhighlight %}

The idea is that you implement this interface, providing implementations of all these elements. E.g. your button would look something like

{% highlight cpp %}
struct my_button : button
{
    void draw(painter &) override;
};
{% endhighlight %}

and then you'd have

{% highlight cpp %}
struct my_element_factory : element_factory
{
    std::shared_ptr<button> make_button() override
    {
        return std::make_shared<my_button>();
    }
};
{% endhighlight %}

Then you could make complex reusable UI components, like a [color picker](https://bitbucket.org/lisyarus/psemek/src/master/libs/ui/include/psemek/ui/color_picker.hpp), that seamlessly work with any `element_factory` -- they use it to create all the UI elements they consist of.

The library provides a simple [default implementation](https://bitbucket.org/lisyarus/psemek/src/master/libs/ui/source/default_element_factory.cpp) of the `element_factory`, with element implementations that mostly look like colored rectangles (who needs more?):

<center><img width="100%" src="{{site.url}}/blog/media/not_ui/villages.png"></center>
<div style="text-align: center"><i>Another project where I've spent too much time on map generation. <br> I absolutely love these islands, though.</i></div>
<br>

The `element_factory` also simplifies adopting the UI in a new project: you use the default factory at the beginning, and then gradually switch to a proper one when the time is right.

Separating logic into base classes and implementing drawing in derived ones works pretty well, but the `element_factory` approach has flaws. Having to list all possible UI components is already a burden; it also forces you to e.g. subclass the base `button` class when implementing your own `button` (it cannot be just `shared_ptr<element> make_button()` because we need extra functionality from the returned object). 

What if I want my element factory to provide some extra components that don't have analogues in the base library? This happens more often then you think, e.g. a specialized time speed control that looks like buttons on an old radio that have to be precisely positioned together. I ended up just referring to the current project's element factory explicitly, without using the base `element_factory` abstraction.

What if there are some elements my factory doesn't support? I'd have to return `nullptr` from such methods or throw an exception. Ideally, though, I wouldn't have to implement these methods at all! (well actually this is exactly how it works: the base `element_factory` returns `nullptr` in most methods already, but still).

So far, so good.

# Flexibility & Integration

Flexibility is easy. You want a UI element that does god knows what? Subclass the base `element` class and do whatever you want.

To integrate the library, you create a simple [*controller*](https://bitbucket.org/lisyarus/psemek/src/master/libs/ui/include/psemek/ui/color_picker.hpp) object that stores the UI tree, distributes events & governs the rendering process. You don't *have* to use it, though: if, for some reason, you want a different event propagation logic or a completely different rendering implementation, you can do that! The whole UI tree doesn't know one bit about this `controller`.

I also made a [gluing wrapper](https://bitbucket.org/lisyarus/psemek/src/master/libs/app/include/psemek/app/ui_scene.hpp) to connect the UI with the SDL2-based application code.

Let's talk about the elephant in the room.

# Automatic layout

I was thinking about some constraint-based systems, like the auto layout in iOS, where you literally write equations on certain values, like `my_button.top = my_label.bottom + 10`, and then the library does some magic to solve these. This sounds cool, but after spending some time thinking about how it will work internally, I felt like this is way too much for my needs. I eventually settled on something like the [SwiftUI layout protocol](https://swiftui-lab.com/layout-protocol-part-1) (which I didn't know was a thing when I was designing my solution).

Each UI element has a `shape` --- an interface with just two methods:

{% highlight cpp %}
struct shape
{
    virtual bool contains(point) const = 0;
    virtual box bbox() const = 0;
};
{% endhighlight %}

*(A `box` is an axis-aligned box.)*

The idea was that I'll support a plethora of different shapes --- boxes, triangles, circles, hexagons, anything! In practice I almost exclusively used a rectangle shape, and there's a triangle shape implementation used only for arrow buttons (and nobody would probably notice if they used a rectangular shape anyway). However, this arbitrary shape support didn't really get in my way, so maybe it's a good thing, I'm still not sure.

Then, each UI element has two methods that retrieve it's current `shape` and force it to `reshape` into a new bounding box:

{% highlight cpp %}
struct element
{
    virtual struct shape const & shape() const = 0;
    virtual void reshape(box) = 0;

    // ...
};
{% endhighlight %}

So, if I want a button to start and `X=100, Y=200` and to be 50 pixels wide and 20 pixels in height, I do something like `button.reshape({100, 200, 150, 220})`, but in practice it is not the user who sets exact element layouts.

Finally, each element can report it's *size constraints* --- how big or small can it be in both dimensions:

{% highlight cpp %}
struct element
{
    virtual box size_constraints() const = 0;

    // ...
};
{% endhighlight %}

Say, if the element can be anything from 20 to 175 pixels wide, it returns the range `[20, 175]` in the X part of the returned box. If the element doesn't have a lower constraint, it returns 0 as the minimum value, and if it doesn't have an upper bound on it's size, it returns infinity as the maximal value. Nice and simple.

All this becomes an *automatic* layout system when parent elements start communicating with their children. Say, we have a horozintal grid (also knows as hstack) layout with two children. First, someone asks it for it's `size_constraints`. It in turns asks it's children' `size_constraints`; then, the minimum X size of the layout is the sum of minimal X sizes of the children plus some spacing between them, and the maximal Y size is the minimum of the maximal Y sizes of the children, etc.

Then, the layout's parent tells it to `reshape` into a new bounding box. It computes the sizes and positions of it's children, and calls `reshape` on each of them with the respective bounding boxes.

All this was hard to get right, and I got a lot of bugs caused by the `size_constraints` and `reshape` not being in sync with each other (e.g. forgetting about spacing in one but not the other method), but eventually I got there:

<center><video width="100%" autoplay muted loop><source src="{{site.url}}/blog/media/not_ui/merchants_layout.mp4" type="video/mp4"></video></center>
<div style="text-align: center"><i>Even the UI scale changes nicely!</i></div>
<br>

The grid layouts also support weights. By default they are set to 1, but if I want a certain element to take twice as much space as the others, I set it's weight to 2. A weight of 0 means this element should use it's minimal possible size. This last bit complicates the layout algorithm: I have to allocate space for minimized elements first, and then distribute what's left among the elements with nonzero weights.

I've spent quite a lot of time chasing bugs with this system that eventually turned out to be intended behaviours. You set some weight to be zero and then some seemingly unrelated elements disappear. You add a sixth button and for some reason it is larger than other five. This just drove me mad.

Other container elements may implement their own logic in these layout methods. A [screen](https://bitbucket.org/lisyarus/psemek/src/master/libs/ui/include/psemek/ui/screen.hpp) (also known as a *stack*) simply puts it's children on top of each other. A [scroller](https://bitbucket.org/lisyarus/psemek/src/master/libs/ui/include/psemek/ui/scroller.hpp) allows to scroll it's child vertically and/or horizontally, etc.

This all worked marvelously until I went more serious about showing text. You see, if you have multiline text that can stretch and shrink and wrap and occupy a variable number of lines, what are it's size constraints? The minimum width is something like the width of the widest letter (or maybe the widest word), because the text can wrap to many lines. The minimum height is the height of a text line, because the whole text can fit into a single, very long line. Does it mean that the minimum (width,height) pair is (width of letter, height of text line)? Bollocks! That would only fit one letter.

With wrapping text, the width and height aren't independent. In fact, there isn't such a thing as the minimal (width,height) pair, rather a set of minimal pairs ([*minimal elements*](https://en.wikipedia.org/wiki/Maximal_and_minimal_elements) but not [*least elements*](https://en.wikipedia.org/wiki/Greatest_element_and_least_element)) all occupying roughly the same area. I spent some time thinking about this *occupying same area* idea: maybe I should constrain the *product* of width and height as well? However, adding some quadratic optimization to the already shaky process seemed like way too much.

Instead, I figured that if the width and height aren't independent anymore, let's just decide on one of them first, and then use the decided size to decide on the second. But what should be the first --- width or height? This is how the [`asymmetric`](https://bitbucket.org/lisyarus/psemek/src/master/libs/ui/include/psemek/ui/asymmetric.hpp) class appeared in my library:

{% highlight cpp %}
struct asymmetric
    : element
{
    virtual void set_width_first(bool value) = 0;
};
{% endhighlight %}

An `asymmetric` element is one that supports this new protocol: select a width first, then use it to select a height, or the other way round. Now that I think of it, there was no reason to make it into a separate interface.

Two new methods are added to the `element` base class:
{% highlight cpp %}
struct element
{
    virtual interval width_constraints(float height) const = 0;
    virtual interval height_constraints(float width) const = 0;

    // ...
};
{% endhighlight %}

So, each element can tell it's width constraints for a fixed height, and vice versa, similar to Qt's [heightForWidth](https://doc.qt.io/qt-6/qwidget.html#heightForWidth). This complicated everything yet one more time, but solved the wrapping text problems.

<center><video width="100%" autoplay muted loop><source src="{{site.url}}/blog/media/not_ui/particles.mp4" type="video/mp4"></video></center>
<div style="text-align: center"><i>This <a href="https://lisyarus.itch.io/particle-simulator">particle simulator</a> manual was a lot of text.</i></div>
<br>

Transitioning to a new protocol is something I still haven't finished (and probably won't --- see the *What's next* section). I gradually implemented these methods every time I noticed something being broken, and it was always a long and painful debugging session. I think that if I'd adopted this scheme from the start and was more careful with the amount of settings each widget supported (i.e. don't let the same widget do margins, borders, spacings, and whatnot), this would have been a much smoother experience.

# Performance

So, I've talked about performance being a goal, but is this thing performant at all, with all that complexity? Well, it is, but I had to work hard to achieve that (jokes on me). Here are the major bottlenecks:

* Style updating & caching, which I've talked about earlier.
* Reshaping (i.e. layout change) loops, i.e. a reshape occurs and changes some property and triggers another reshape. I genuinely don't remember where these came from, but I do remember fighting them a lot.
* Text views. You don't want to re-position all glyphs each frame, so the prepared & positioned glyphs are cached until a new reshape happens.
* Rendering. Don't issue a draw call for each glyph/image, batch them as much as possible and you'll be happy.

So, caching solves most problems, not writing stupid code solves the remaining ones. Easy.

*\*Cries in infinite loops\**

# Other problems

A few other things I wasn't satisfied with in this library:

* **Mouse handling**. The current mouse position & button clicked state wasn't stored anywhere. Instead, each element is supposed to handle the respective events and cache everything it needs. However, if something else intercepts the `mouse_move` event, the elements continues thinking that the mouse is still where it used to be. This lead to a huge number of minor bugs with element states, like a button thinking it's still pressed or a scrollbar continuing to scroll even if the mouse is way off the scrollbar area.
* **Diamond inheritance**. A classical pitfall of OOP, solved in C++ be the virtual inheritance feature. I moved all extra functionality in separate subclasses of the base `element`, and after some time I inevitably needed to inherit from more than one of them. I slapped `virtual` to all places inheriting the base `element` class, which solved 95% of such problems, but that still feels really dirty.
* **Lifetime hell**. I've said that I used `shared_ptr`'s everywhere to store the elements, and of course sometimes there were memory leaks due to long element->callback->callback->element->callback->element pointer loops. Another problem is when you need something very dynamic, like a table of values that change all the time and the number of rows varies and there are buttons on each row. You can't recreate the elements from scratch on each frame, since the buttons' state will be reset and it will forget that you've put a mouse over it. In these cases, I ended up implementing ad-hoc versions of something like React's [reconciliation](https://reactjs.org/docs/reconciliation.html), and I don't recommend trying this at home.

If you think I'm overengineering everything, well first of all yes I am, but really look at any UI library in the wild or, better, try making one yourself: it is a really, genuinely hard thing to get right.

# What's next?

All this works or can be made to work eventually, but over two years I've become really tired of this library. Too much to fix, too much to debug, too much legacy, too many unintuitive behaviours. Will I use an existing, production-tested solution instead, then? Hell, no :)

Designing complex systems is something I love so, so much, that I just cannot miss the oportunity to do it one more time! I've spent the last weeks reading about React, SwiftUI and Flexbox, and came up with some ideas on what the new library should look like:

* The **object-oriented style** is probably going to stay, but will be *hidden* from the user as much as possible.
* **Automatic layout** is probably fine, I like it the way it is, but it will be re-implemented carefully from scratch in an **asymmetric** way.
* The **events model** is also OK, but I probably need to add something like `mouse_enter/mouse_leave` events.
* The user won't **own** the UI elements; they will be owned by the library.
* Instead, the user will provide some **declarative description** of the UI, which will be **reconciliated** upon change using a dedicated **element factory**.
* All UI changes should happen only through changes in a network of [**reactive variables**](https://en.wikipedia.org/wiki/Reactive_programming), and the library will make sure to do all the required updates as locally as possible.
* The **style** will either be turned into something incredibly generic (like a map of string values), or completely removed, and only one global style set in the **element factory** will be supported. You want a red button? Implement a `make_red_button()` method. This should also make the UI look more uniform.
* Remove the **element factory** interface, but still provide a default implementation for easy integration.

This is roughly what I want my new UI description to look like:

{% highlight cpp %}
ui::any make_ui()
{
    auto value = react::source(0);
    auto text = react::map(util::to_string, value);

    return ui::hlayout {{'{{'}}
        ui::button {
            .on_click = [value]{
                value.set(*value + 1);
            },
            .child = ui::label {
                .text = "Add 1",
            }
        },
        return ui::label {
            .text = text,
        }
    }};
}
{% endhighlight %}

I'll write a new post once I've finished designing and testing a new library (which might take months...).

As usual, watch my devlogs:
<iframe width="100%" style="aspect-ratio:16/9" src="https://www.youtube.com/embed/GazsE5NDMj8" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe><br/>

try my <a href="https://lisyarus.itch.io/particle-simulator">particle simulator</a>, and huge thanks for reading!

<a href="https://lisyarus.itch.io/particle-simulator"><img width="100%" src="https://img.itch.zone/aW1hZ2UvMTg2MzkzNS8xMDk1MTQ2OC5wbmc=/original/CHcTAG.png"></a>
