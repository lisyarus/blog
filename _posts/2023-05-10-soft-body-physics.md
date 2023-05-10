---
layout: post
title:  "Making a 2D soft-body physics engine"
date:   2023-05-10 11:00:00 +0300
categories: physics
---

<style>

p {
	text-align: justify;
}

img.formula {
}

</style>

<script src="https://www.steamwidgets.com/api/resource/query?type=js&module=app&version=v1"></script>

Recently, I participated in [Ludum Dare 53](https://ldjam.com/events/ludum-dare/53) and made a [silly spaceship building game](https://lisyarus.itch.io/andromeda-delivery-service) based on a soft-body physics engine.

<center><img width="100%" src="{{site.url}}/blog/media/soft_body_physics/spaceship.png"></center>
<div style="text-align: center"><i>An example modular spaceship you can build in the game.</i></div>
<br>

I figured I'd share how this physics engine works, since it's actually remarkably simple :)

**Contents:**
* TOC
{:toc}

# Solids or point masses?

When making a physics engine, there is always a question of whether you simulate actual solid objects like boxes, disks, capsules, etc, or stick to having just point masses instead. Here are a few things to consider:

* The state of a solid object consists of its **position**, **velocity**, **orientation**, and **angular velocity**. For point masses, you don't need the rotational stuff, just **position** and **velocity**. *(Rotation doesn't make sense for single points: the only point of this object is its center of mass, and the rotation of center of mass around itself is zero. The inertia tensor of a point mass is zero, etc.)* Rotation is tricky to handle, especially when your objects collide or you apply forces to specific points on an object (e.g. push by player, nearby explosion, etc).
* Solid objects are more **physically correct**. We can emulate e.g. a box with four point masses together with some constraints that force them to maintain a box-like shape, but constraints are also tricky to do right and will usually be voilated from time to time, meaning your box won't be a box. Also four connected vertices have mass concentrated in the vertices, therefore it will have an inertia tensor different to that of a box, and this will affect how our improvised box reacts to forces & rotation. Imagine a shallow wooden box compared to solid filled polymeric foam box - the difference is quite similar to our case.
* Collisions between point masses are basically meaningless, unless we pretend that our "points" actually have a radius and treat them as disks just for collisions (they're still not *rotating disks*, though, and you will notice that they behave a bit weird because of this). Collisions between point masses and static environment, on the other hand, are as easy as collisions go! Compare this to collisions between solids: they're easy if you only support disks (still need to correctly handle friction & rotation & etc), but if you want boxes/capsules/polygons you need to write some pretty non-trivial collision detection code, and in any case the collision response is quite involved.

<center><video width="100%" autoplay muted loop><source src="{{site.url}}/blog/media/soft_body_physics/point_masses.mp4" type="video/mp4"></video></center>
<div style="text-align: center"><i>A <a href="https://twitter.com/lisyarus/status/1318605976786919424">physics engine</a> based on point masses can simulate a lot of fun stuff.</i></div>
<br>

So, neither option is better or worse, they're just different and suit different use cases. Most physics engines are built on solid objects because that's a more universal (albeit much more complicated) approach. In my case, however, I wanted a *soft-body* engine, meaning my so-called solid objects will deform freely and stop being solids. I'm sure there are ways to handle this inside a typical solid object-based engine, but I decided to use the point masses instead: they are simpler to code, and they already allow for arbitrary deformations, just need to figure out how to force the points to loosely maintain some shape.

# Velocity integration

Let's write a 2D point mass physics engine without any constraints or extra forces. It's really just a few lines of code:

{% highlight cpp %}
struct point_mass
{
    vec2 position;
    vec2 velocity;
};

struct engine
{
    std::vector<point_mass> points;
    vec2 gravity;

    void update(float dt)
    {
        for (auto & p : points)
            p.velocity += gravity * dt;

        for (auto & p : points)
            p.position += p.velocity * dt;
    }
}
{% endhighlight %}

First, we update the velocities using the external forces (called `gravity` here, but it can be any external force, and it can differ for different objects / points in space). Then, we update the positions using the velocities, and that's it. This is the [symplectic Euler](https://en.wikipedia.org/wiki/Semi-implicit_Euler_method) integration method, known for good energy conservation properties. It is also remarkably simple; simpler than the universally beloved [Vertet method](https://en.wikipedia.org/wiki/Verlet_integration).

Right now, we have something like this:

<center><video width="100%" autoplay muted loop><source src="{{site.url}}/blog/media/soft_body_physics/point_masses_1.mp4" type="video/mp4"></video></center>
<div style="text-align: center"><i>There's no gravity here.</i></div>
<br>

# Collision detection

Since I'm planning to use these point masses only as building blocks for soft bodies, I don't care about collisions between two point masses. However, I still need collisions between points and the environment.

For the collision to work, we need a routine that computes the **collision normal** and **penetration depth** of the collision. For example, if my "environment" is just a floor below the `Y=0` line, its collision normal points upwards, and the penetration depth for a point at `(X, Y)` is simply `-Y`:

{% highlight cpp %}
struct collision
{
    vec2 normal{0.f, 0.f};
    float depth = -std::numeric_limits<float>::infinity();
};

collision find_collision(vec2 const & position)
{
    return collision{vec2{0.f, 1.f}, -position.y};
}
{% endhighlight %}

Negative penetration depth means there is no collision.

My game actually only uses collisions with planets, i.e. with static disks, which looks like this:

{% highlight cpp %}
struct planet
{
    vec2 center;
    float radius;
};

collision find_collision(vec2 const & position, planet const & planet)
{
    vec2 delta = position - planet.center;
    float distance = length(delta);
    vec2 normal = delta / distance;
    float depth = planet.radius - distance;
    return collision{normal, depth};
}
{% endhighlight %}

If we have several colliding obstacles, we simply find the collision with the largest penetration depth - it is probably the most important one!

{% highlight cpp %}
collision find_collision(vec2 const & position, std::vector<planet> const & planets)
{
    collision result;
    for (auto const & planet : planets)
        if (auto c = collision(position, planet); c.depth > result.depth)
            result = c;
    return result;
}
{% endhighlight %}

Notice that we've initialized the depth to `-inf` in the `collision` constructor, so that a default-constructed `collision` acts as no collision, and its `depth` value is the neutral element with respect to `max`.

# Collision resolution

I'm very annoyed that most resources on physics engine collisions only mention collision detection. Like, it's usually the easy part! Especially with rotating solids. Especially in 3D!

Anyway, we got our collision normal & penetration depth. There are three things we need to do:

1. Push the point mass along the collision normal so that no collision is present. Or, in fancy language, prevent collision constraint violation. This is important to do because even if we do the velocity update described next, something (external forces, springs, soft body constraints, etc) might still push our object inside the collider. This is known as *sinking*, or more generally as *constraint drifting*: we have fixed the *time derivative* of the constraint function, but we didn't fix the constraint itself. This pushing along collision normal can be problematic if you have some interaction forces, e.g. gravitational attraction: changing the position of an object changes the potential energy of this interaction, meaning our collisions will randomly add or remove energy to/from the system. Yikes! *(see [my another post](https://lisyarus.github.io/blog/physics/2022/10/25/collisions.html) where I explore the specific problem of collision resolution messing up with gravity simulation)*. There is an alternative option to only resolve collision if the object is moving towards the collider, not away from it (i.e. if the dot product of the object's velocity and the collision normal is negative), but it only helps in very simple situations.
2. Update the normal component of the velocity. If you throw a ball towards a wall, it will bounce back. This is what things typically do when they collide something: they bounce back, maybe losing some energy in the process. This is usually captured as the *elasticity coefficient*, or *bounciness*: `elasticity = 0` means the object will stop upon collision, `elasticity = 1` means the object will retain its kinetic energy in full.
3. Update the tangentinal component of the velocity, or, in simple terms, apply friction. Our point masses don't rotate, so this will be relatively easy: we multiply the tangential component by a factor of the form `(1 - friction * dt)`, or a much more stable & precise alternative `exp(- friction * dt)`. This means that while our point mass is in contact with the collider, it's speed *along* the collider will get smaller over time. Notice that while `elasticity` is a unitless coefficient in the range `[0..1]`, `friction` has units `1/TIME` and can be any positive number (at least if you use the stable formula, otherwise it cannot be larger than `1/dt`) and `1/friction` is roughly *the time it takes for the object to drop 63% of it's speed*, something like that. *(0.63 is the value of `1 - exp(-1)`; by the way, see [this post](https://lisyarus.github.io/blog/2023/02/21/exponential-smoothing.html) to learn where this exponential comes from)*.

Enough talking, here's the code:

{% highlight cpp %}
void engine::update(float dt)
{
    // ... velocity integration ...

    for (auto & p : points)
    {
        collision c = find_collision(p.position, the_world);

        // check if collision took place
        if (c.depth < 0.f) continue;

        // resolve the constraint
        p.position += c.normal * c.depth;

        // compute the normal & tangential velocity
        auto vn = c.normal * dot(c.normal, p.velocity);
        auto vt = p.velocity - vn;

        // apply bouncing
        vn = - elasticity * vn;

        // apply friction
        vt *= std::exp(- friction * dt);

        // add up the new velocity
        p.velocity = vn + vt;
    }
}
{% endhighlight %}

Just a few formulas here and there and we get this:

<center><video width="100%" autoplay muted loop><source src="{{site.url}}/blog/media/soft_body_physics/point_masses_3.mp4" type="video/mp4"></video></center>
<div style="text-align: center"><i>Bouncing with elasticity = 0.5 and friction = 100.<br>Collisions are handled as if the points have a nonzero radius, but otherwise the logic is the same.</i></div>
<br>

# Hard constraints

Say, I want to connect two objects in my physics engine with an invisible stick of a certain length. Or maybe I want to *constrain* the movement of an object to only happen along some predefined curve. This is what *constraints*, also known as *joints*, are for. Usually we're interested in *equality constraints*, meaning we want some function of our system to be equal to zero: `f(system) = 0`. For example, if I want a point mass to only move along the `X=Y` line, I'd do `f(system) = points[0].position.x - points[0].position.y`. If I want the distance between two points to be fixed, I'd do `f(system) = length(points[0].position - points[1].position) - required_distance`, etc.

Collisions are an example of an *inequality constraint* `f(system) <= 0`. We resolve the collision if the penetration depth is positive, but once it is negative, we don't care. Some engines (like [Box2D](https://box2d.org/)) treat collisions together with other constraints in a single constraint resolution framework; others (like [Bullet](https://github.com/bulletphysics/bullet3), iirc) treat them as a separate thing entirely.

Constraint resolution is a pretty complicated topic in general, but in some cases we can hack them a bit. For example, to resolve the distance constraint between a pair of point masses, we can simply move the two points along the line between them so that the distance is as required:

{% highlight cpp %}
struct distance_constraint
{
    uint32_t index0, index1;
    float distance;
};

struct engine
{
    // ...

    std::vector<distance_constraint> constraints;
};

void engine::update(float dt)
{
    // ... velocity integration ...
    // ... collision resolution ...

    for (auto const & c : constraints)
    {
        auto & p0 = points[c.index0].position;
        auto & p1 = points[c.index1].position;

        auto delta = p1 - p0;
        auto distance = length(delta);

        auto required_delta = delta * (c.distance / distance);
        auto offset = required_delta - delta;

        p0 -= offset / 2.0;
        p1 += offset / 2.0;
    }
}
{% endhighlight %}

This is an example of a *hard constraint*: we force the constraint to be always satisfied, to behave as a *rigid* thing.

# Soft constraints

We could instead move the objects bound by a constraint a bit every frame, so that the constraint gets satisfied if we wait long enough:

{% highlight cpp %}
void engine::update(float dt)
{
    // ... velocity integration ...
    // ... collision resolution ...

    for (auto const & c : constraints)
    {
        auto & p0 = points[c.index0].position;
        auto & p1 = points[c.index1].position;

        auto delta = p1 - p0;
        auto distance = length(delta);

        auto required_delta = delta * (c.distance / distance);
        float damping_factor = 1.f - std::exp(- constraint_damping * dt);
        auto offset = (required_delta - delta) * damping_factor;

        p0 -= offset / 2.0;
        p1 += offset / 2.0;
    }
}
{% endhighlight %}

Or we could use *force-based* constraints instead: apply forces to the constraint-bound objects that would move the system towards a state when the constraint is satisfied. For the distance constraint, the corresponding force-based thing is called a *spring*:

{% highlight cpp %}
void engine::update(float dt)
{
    // ... velocity integration ...
    // ... collision resolution ...

    for (auto const & c : constraints)
    {
        auto p0 = points[c.index0].position;
        auto p1 = points[c.index1].position;

        auto delta = p1 - p0;
        auto distance = length(delta);

        auto required_delta = delta * (c.distance / distance);
        auto force = spring_force * (required_delta - delta);

        points[c.index0].velocity -= force * dt;
        points[c.index1].velocity += force * dt;
    }
}
{% endhighlight %}

And this is what we get:

<center><video width="100%" autoplay muted loop><source src="{{site.url}}/blog/media/soft_body_physics/spring_1.mp4" type="video/mp4"></video></center>
<div style="text-align: center"><i>dt = 0.001, spring_force = 100</i></div>
<br>

Much better for a *soft-body* engine! However, we probably don't want it to oscillate indefinitely, so we need some damping. This is a bit tricky: we only want to dampen the wiggling along the spring, but we don't want to touch the movement of these two point masses as a whole, and we want to preserve its rotation.

To achieve this, we compute the relative velocity along the spring's direction, compute the dampened velocity, and split the velocity correction between the two point masses:

{% highlight cpp %}
void engine::update(float dt)
{
    // ... velocity integration ...
    // ... collision resolution ...

    for (auto const & c : constraints)
    {
        auto p0 = points[c.index0].position;
        auto p1 = points[c.index1].position;
        auto & v0 = points[c.index0].velocity;
        auto & v1 = points[c.index1].velocity;

        auto delta = p1 - p0;
        auto distance = length(delta);
        auto direction = delta / distance;

        auto required_delta = direction * c.distance;
        auto force = spring_force * (required_delta - delta);

        v0 -= force * dt;
        v1 += force * dt;

        auto vrel = dot(v1 - v0, direction);
        auto damping_factor = exp(- spring_damping * dt);
        auto new_vrel = vrel * damping_factor;
        auto vrel_delta = new_vrel - vrel;

        v0 -= vrel_delta / 2.0;
        v1 += vrel_delta / 2.0;
    }
}
{% endhighlight %}

With this damped spring, we get a nice soft distance constraint:

<center><video width="100%" autoplay muted loop><source src="{{site.url}}/blog/media/soft_body_physics/spring_2.mp4" type="video/mp4"></video></center>
<div style="text-align: center"><i>dt = 0.001, spring_force = 100, damping = 10</i></div>
<br>

We can crank up the constants a bit and get something that looks like a rigid, hard constraint, but is still a soft constraint:

<center><video width="100%" autoplay muted loop><source src="{{site.url}}/blog/media/soft_body_physics/spring_3.mp4" type="video/mp4"></video></center>
<div style="text-align: center"><i>dt = 0.001, spring_force = 10000, damping = 200</i></div>
<br>

Of course, soft constraints have their downsides. They are *force-based*, so if there is a stronger force in the system (gravity, or another constraints), the constraint will be violated a lot. There are certain bounds on the constraint force (something like `spring_force * dt * dt < 1`), otherwise the system will be unstable. But for a soft-body physics engine, they work pretty great!

# Soft bodies

So, how do we use all that information to make a soft-body physics engine? Like, how do we make a soft box? The first idea that comes to mind is to connect all vertices of the box with springs, and it indeed works:

<center><video width="100%" autoplay muted loop><source src="{{site.url}}/blog/media/soft_body_physics/spring_4.mp4" type="video/mp4"></video></center>
<br>

but there is a problem with this approach: it does exactly what it says, meaning it only maintains pairwise distances between the points and doesn't care about their overall shape. In particular, this box made of 6 springs can be easily turned inside-out to form a different box:

<center><video width="100%" autoplay muted loop><source src="{{site.url}}/blog/media/soft_body_physics/spring_5.mp4" type="video/mp4"></video></center>
<br>

and this spring-based "wheel" can be messed up so bad that is starts to levitate on it's own:

<center><video width="100%" autoplay muted loop><source src="{{site.url}}/blog/media/soft_body_physics/spring_6.mp4" type="video/mp4"></video></center>
<br>

We could add extra constraints on the *angles* between consecutive points, but this would only hide and overcomplicate the problem. *(However, this is very common in molecular dynamics simulations; they even use the angle between the two planes formed by four consecutive points!)*

It turns out that there is a better way of simulating soft bodies.

# Shape matching

I don't know a well-established name for this, and a quick google search failed to reveal anything of releavance, so I will call this method *shape-matching*. If you know some resources on this, I would love to know them, since I had to derive all the equations myself :) It doesn't only apply to soft bodies or physics simulations, though: it is a much more general technique.

So, we want our points to *preserve their shape*. By *shape* we mean some solid object - a box or a polygon, for example. We want our points to form the vertices of this shape. However, in general they won't do that due to various forces acting on them.

Instead, let's do this: given the *current positions* of our points, let's find the *ideal position* of our solid shape so that it matches the *current shape* as much as possible. Since the *ideal shape* is solid, it can only move and rotate as a whole. *If I'm not mistaken, [JellyCar physics engine](https://www.youtube.com/watch?v=3OmkehAJoyo) uses the same concept.*

# A bit of math

*If you don't care about the formula derivations, you can safely skip this part!*

Let's say that we have <img class="formula" src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B200%7D%20N"> points, and our *ideal shape* is specified by the vectors <img class="formula" src="https://latex.codecogs.com/png.latex?%5Cdpi%7B200%7D%20q_i"> from the shape's center of mass towards the shape's vertices. Our *current points* are <img class="formula" src="https://latex.codecogs.com/png.latex?%5Cdpi%7B200%7D%20p_i">. First, let's compute the *current* center of mass:

<center><img src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B200%7D%20C%20%3D%20%5Cfrac%7B1%7D%7BN%7D%5Csum%20p_i"></center><br/>

Then, compute the *current* points relative to the center of mass:

<center><img src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B200%7D%20r_i%20%3D%20p_i%20-%20C"></center><br/>

It would be wrong to expect <img class="formula" src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B200%7D%20r_i%20%3D%20q_i"> because our *ideal shape* can be *rotated*! Let <img class="formula" src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B200%7D%20R_%5Ctheta"> e the [operator of rotation](https://en.wikipedia.org/wiki/Rotation_matrix) by an angle <img class="formula" src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B200%7D%20%5Ctheta">:

<center><img src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B200%7D%20R_%5Ctheta%20%3D%20%5Cbegin%7Bpmatrix%7D%5Ccos%5Ctheta%20%26%20-%5Csin%5Ctheta%20%5C%5C%20%5Csin%5Ctheta%20%26%20%5Ccos%5Ctheta%5Cend%7Bpmatrix%7D"></center><br/>

What we want is <img class="formula" src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B200%7D%20r_i%20%3D%20R_%5Ctheta%20%5Ccdot%20q_i">, i.e. that the rotated *ideal shape* coincides with the *current shape*. This will, in general, not be true (again because of various other forces acting on our point masses), so we need to find a way to *force* it be true.

We can employ a classic trick of turning an equation into a minimization problem: let's try to minimize the sum of squared distances between the *current positions* and the *ideal positions*; the *ideal shape* that minimizes this value will be the shape we are looking for!

<center><img src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B200%7D%20E%20%3D%20%5Csum%28r_i%20-%20R_%5Ctheta%20%5Ccdot%20q_i%29%5E2"></center><br/>

I've called it <img class="formula" src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B200%7D%20E"> because it resembles some energy formula, like for a [harmonic oscillator](https://en.wikipedia.org/wiki/Harmonic_oscillator).

The only unknown in the above equation is <img class="formula" src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B200%7D%20%5Ctheta">, so we need to differentiate the above formula with respect to this angle and set the derivative be equal to zero:

<center><img src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B200%7D%20%5Cfrac%7BdE%7D%7Bd%5Ctheta%7D%20%3D%20%5Csum%202%20%28r_i%20-%20R_%5Ctheta%20%5Ccdot%20q_i%29%5Ccdot%20%28-%5Cfrac%7BdR_%5Ctheta%7D%7Bd%5Ctheta%7D%20%5Ccdot%20q_i%29%20%3D%200"></center><br>

We're using the fact that the derivative of a squared length of a vector can be expressed using a dot product of the vector and it's derivative:

<center><img src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B200%7D%20%5Cfrac%7Bd%7D%7Bd%5Ctheta%7D%20A%5E2%20%3D%202%20A%20%5Ccdot%20%5Cfrac%7BdA%7D%7Bd%5Ctheta%7D"></center><br>

The expression for <img src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B200%7D%20%5Cfrac%7BdE%7D%7Bd%5Ctheta%7D"> above looks a bit intimidating, but don't fret, we'll deal with it step by step.

First, ignore the factor of 2, it can be simply divided away (i.e. dividing both sides by 2).

Next, each summand is a dot product of two vectors: <img src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B200%7D%20r_i%20-%20R_%5Ctheta%20%5Ccdot%20q_i"> and <img src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B200%7D%20-%5Cfrac%7BdR_%5Ctheta%7D%7Bd%5Ctheta%7D%5Ccdot%20q_i">, the latter is a product of a matrix <img src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B200%7D%20-%5Cfrac%7BdR_%5Ctheta%7D%7Bd%5Ctheta%7D"> and a vector <img src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B200%7D%20q_i">.

It so happens that <img src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B200%7D%20%5Cfrac%7BdR_%5Ctheta%7D%7Bd%5Ctheta%7D%20%3D%20R_%7B%5Ctheta&plus;%5Cfrac%7B%5Cpi%7D%7B2%7D%7D">, meaning this matrix rotates by an angle of <img src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B200%7D%20%5Ctheta"> plus 90 degrees. This also means that for any vector <img src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B200%7D%20v">, <img src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B200%7D%20%28R_%5Ctheta%5Ccdot%20v%29%20%5Ccdot%20%28%5Cfrac%7BdR_%5Ctheta%7D%7Bd%5Ctheta%7D%20%5Ccdot%20v%29%20%3D%200"> because these two vectors are rotated by a straight angle, i.e. by 90 degrees, meaning they are orthogonal.

What this means for us is that in each summand of our big formula, the <img src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B200%7D%20%28R_%5Ctheta%5Ccdot%20q_i%29%20%5Ccdot%20%28%5Cfrac%7BdR_%5Ctheta%7D%7Bd%5Ctheta%7D%20%5Ccdot%20q_i%29"> part is zero, and we are only left with <img src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B200%7D%20r_i%20%5Ccdot%20%28%5Cfrac%7BdR_%5Ctheta%7D%7Bd%5Ctheta%7D%20%5Ccdot%20q_i%29"> (I've removed the minus sign which also doesn't add anything now).

So, we're left with this equation:

<center><img src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B200%7D%20%5Csum%20r_i%20%5Ccdot%20%28%5Cfrac%7BdR_%5Ctheta%7D%7Bd%5Ctheta%7D%20%5Ccdot%20q_i%29%20%3D%200"></center><br>

We probably could do some more tricks to derive a concise equation for <img class="formula" src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B200%7D%20%5Ctheta"> in matrix form, but I'll just expand everything in coordinates instead:

<center><img src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B200%7D%20%5Cfrac%7BdR_%5Ctheta%7D%7Bd%5Ctheta%7D%20%3D%20%5Cbegin%7Bpmatrix%7D%20-%5Csin%5Ctheta%20%26%20-%5Ccos%5Ctheta%20%5C%5C%20%5Ccos%5Ctheta%20%26%20-%5Csin%5Ctheta%5Cend%7Bpmatrix%7D"></center><br>

<center><img src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B200%7D%20%5Cfrac%7BdR_%5Ctheta%7D%7Bd%5Ctheta%7D%20%5Ccdot%20q_i%20%3D%20%5Cbegin%7Bpmatrix%7D-q_i%5EX%5Csin%5Ctheta%20-q_i%5EY%5Ccos%5Ctheta%20%5C%5C%20q_i%5EX%5Ccos%5Ctheta%20-%20q_i%5EY%5Csin%5Ctheta%5Cend%7Bpmatrix%7D"></center><br>

<center><img src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B200%7D%20r_i%20%5Ccdot%20%28%5Cfrac%7BdR_%5Ctheta%7D%7Bd%5Ctheta%7D%20%5Ccdot%20q_i%29%20%3D%20r_i%5EX%20%5Ccdot%20%28-q_i%5EX%5Csin%5Ctheta-q_i%5EY%5Ccos%5Ctheta%29%20&plus;%20r_i%5EY%5Ccdot%28q_i%5EX%5Ccos%5Ctheta%20-%20q_i%5EY%5Csin%5Ctheta%29%20%3D%20%5C%5C%20%3D%20%5Csin%5Ctheta%20%5Ccdot%20%28-r_i%5EXq_i%5EX-r_i%5EYq_i%5EY%29%20&plus;%20%5Ccos%5Ctheta%20%5Ccdot%20%28-r_i%5EXq_i%5EY%20&plus;%20r_i%5EYq_i%5EX%29%20%3D%20%5C%5C%20%3D%20-%5Csin%5Ctheta%20%28r_i%5Ccdot%20q_i%29%20-%20%5Ccos%5Ctheta%28r_i%20%5Ctimes%20q_i%29"></center><br>

Here, a cross means the [exterior product](https://en.wikipedia.org/wiki/Exterior_algebra), also occasionally known as the *skew product* or the *pseudoscalar product*. It is the 2D analogue of a [cross product](https://en.wikipedia.org/wiki/Cross_product) and equals the signed area of a parallelogram spanned by two vectors.

# The final formula

Our final equation now looks like this:

<center><img src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B200%7D%20-%5Csin%5Ctheta%20%5Cleft%28%5Csum%20r_i%5Ccdot%20q_i%5Cright%29%20-%20%5Ccos%5Ctheta%20%5Cleft%28%5Csum%20r_i%5Ctimes%20q_i%5Cright%29%20%3D%200"></center><br>

Which can be solved easily:

<center><img src="https://latex.codecogs.com/png.latex?%5Cdpi%7B200%7D%20%5Ctan%5Ctheta%20%3D%20-%20%5Cfrac%7B%5Csum%20r_i%5Ctimes%20q_i%7D%7B%5Csum%20r_i%5Ccdot%20q_i%7D"></center><br>
<center><img src="https://latex.codecogs.com/png.latex?%5Cdpi%7B200%7D%20%5Ctheta%20%3D%20-%5Coperatorname%7Batan2%7D%28%5Csum%20r_i%5Ctimes%20q_i%2C%20%5Csum%20r_i%5Ccdot%20q_i%29"></center><br>

That's an extremely neat formula, if you ask me!

# At last, soft bodies

So we have a formula for the angle <img class="formula" src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B200%7D%20%5Ctheta">, meaning we can compute the *ideal positions* of our points that are as close to the *current positions* as possible. What do we do with them, though? We could simple move the points to these ideal positions, but that would be a *hard constraints* (although it would work much better than a distance constraint-based thing).

To make it into a *soft body*, we can add a spring-like force for each point mass towards it's *ideal position*:

{% highlight cpp %}
float cross(vec2 a, vec2 b)
{
    return a.x * b.y - a.y * b.x;
}

struct soft_body
{
    struct vertex
    {
        uint32_t index;
        vec2 position;
    };
    std::vector<vertex> vertices;
};

struct engine
{
    // ...

    std::vector<soft_body> soft_bodies;
};

void engine::update(float dt)
{
    // ... velocity integration ...
    // ... collision resolution ...

    for (auto const & b : soft_bodies)
    {
        // compute the center of mass
        vec2 center = vec2(0.f, 0.f);
        for (auto const & v : b.vertices)
            center += points[v.index].position;
        center /= (float)b.indices.size();

        // compute the shape rotation angle
        float A = 0.f, B = 0.f;
        for (auto const & v : b.vertices)
        {
            auto r = points[v.index].position - center;
            A += dot(r, v.position);
            B += cross(r, v.position);
        }
        float angle = -atan2(B, A);

        // apply spring forces
        for (auto const & v : b.vertices)
        {
            auto target = center + rotate(v.position, angle);
            auto delta = target - points[v.index].position;
            points[v.index].velocity += spring_force * delta * dt;
        }
    }
}
{% endhighlight %}

This works great. Here's how it looks if every `soft_body` is just a square containing 4 points (note that different bodies can share points, allowing for complex structures made of several soft bodies):

<center><video width="100%" autoplay muted loop><source src="{{site.url}}/blog/media/soft_body_physics/final_1.mp4" type="video/mp4"></video></center>
<div style="text-align: center"><i>Weeee!</i></div>
<br>

However, we see that it wiggles forever, because our springs aren't damped. In my implementation, I added damping between any pair of consecutive vertices of a soft body, but I think it is better to compute the velocity of the center of mass (i.e. just the average velocity of the points of a soft body), compute the average angular velocity of rotation around the center of mass, compute the *target velocity* of each point mass treating the whole soft body as a solid body, and then add damping by slowly interpolating the velocities towards these target velocities.

These two methods of adding damping seem to produce quite similar results:

<center><video width="100%" autoplay muted loop><source src="{{site.url}}/blog/media/soft_body_physics/final_2.mp4" type="video/mp4"></video></center>
<div style="text-align: center"><i>Giving different spring force constants to different bodies makes it wiggle differently depending on the overall structure.</i></div>
<br>

# The end?

As usual, I wanted to explain something small but ended up writing a whole tutorial :) Hope you liked it.

By the way, wishlist my road building & traffic simulation game

<center><steam-app appid="2403100"></steam-app></center>
<br>

watch the devlog about it

<iframe width="100%" style="aspect-ratio:16/9" src="https://www.youtube.com/embed/s-G0GoJEwds" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe><br/>

and thanks for reading!