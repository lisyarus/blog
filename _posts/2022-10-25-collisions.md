---
layout: post
title:  "The quest for perfect collisions"
date:   2022-10-25 18:00:00 +0300
categories: physics
---

# You spin me right round

As soon as I learnt basic programming & graphics (I think it was in [Dark Basic](https://en.wikipedia.org/wiki/The_Game_Creators#DarkBASIC), some 12 to 14 years ago), I started coding gravity simulations. Just a bunch of 2D balls flying around, gravitating towards each other. I reinvented things like [Verlet](https://en.wikipedia.org/wiki/Verlet_integration) and [symplectic Euler](https://en.wikipedia.org/wiki/Semi-implicit_Euler_method) integration without even knowing what they mean, hacked together some collisions, and got something roughly like this:

<center><video width="600" muted controls><source src="{{site.url}}/blog/media/collisions/planet-intro.mp4" type="video/mp4"></video></center>
<br/>

If you're interested in details, this has about 3000 simulation iterations with a Δt=0.01 (so the simulation time is 30 seconds), gravitational constant G=500, and 500 balls, each of radius from 0.5 to 2 and similar mass, scattered in a circle of radius 100.

Now, it definitely looks like gravity works, and it's fun to watch, but it has a huge problem: it *spins*. And not just that: it *spins with acceleration*. No, wait, it's even worse: *is spins with acceleration starting from any initial state*. This means that angular momentum isn't conserved. Quite the opposite, in fact: it seems to escalate any already-present angular momentum, and there always will be some nonzero angular momentum due to numerical errors (something smart people call an *unstable equilibrium*).

What's the deal, then? It's a numerical simulation, we know it is subject to numerical errors. Well, accelerated spinning produces centrifugal forces that eventually tear everything apart (as can be seen in the clip), meaning no stable configuration of particles is possible: any such "planet" will eventually spin itself to hell. 

This saddened me a lot. Heck, it still does! I can't simulate the formation of a planet from a proto-planetary disk, formation of moons, and other cool stuff I've read in books, just because my simulation likes to spin. I've tried to code this from scratch repeatedly in years and never seemed to fix that problem in a satisfying way. Recently I did it again, tried a dozen of different ways to simulate that, and decided to document the results. *Spoiler: I didn't find a satistying solution, but I've found a promising one.*

# Setting up the stage

First, let's make the most basic simulation: balls with various masses will fly around with gravity pushing them together, and let's pretend collisions never happen (i.e. the balls are really point particles). The full code for a single iteration of such simulation looks roughly like this:

{% highlight cpp %}
// defined somewhere
std::vector<particle> particles;

// apply forces
for (size_t i = 0; i < particles.size(); ++i)
{
    for (size_t j = i + 1; j < particles.size(); ++j)
    {
        vec2 delta = particles[j].position - particles[i].position;
        float distance = length(delta);
        vec2 direction = delta / distance;

        // Newton's law of gravity
        vec2 force = direction * G * particles[i].mass
            * particles[j].mass / pow(distance, 2.f);

        // F = ma together with v' = a
        particles[i].velocity += force * dt / particles[i].mass;
        particles[j].velocity -= force * dt / particles[j].mass;
    }
}

// integrate position
for (size_t i = 0; i < particles.size(); ++i)
{
    // x' = v
    particles[i].position += particles[i].velocity * dt;
}
{% endhighlight %}

This idea of updating velocities and then using them to update the positions is called the [symplectic Euler scheme](https://en.wikipedia.org/wiki/Semi-implicit_Euler_method). It all looks like this:

<center><video width="600" muted controls><source src="{{site.url}}/blog/media/collisions/planet-intro.mp4" type="video/mp4"></video></center>
<br/>

It is arguable quite fun, but it is also a complete mess. Particles don't collide, so they just fly around at high speeds. They also yeet far away often: due to a discrete time step two particles can appear arbitrarily close to each other, and the <img src="https://latex.codecogs.com/png.latex?%5Clarge%20%5Cfrac%7B1%7D%7BR%5E2%7D"/> part of the force becomes huge, so the particles get huge acceleration and gain a very high speed instantly. This doesn't happen in reality, where other forces (electromagnetic, for the most part) are much stronger than gravity at small distances and keep things away from each other.

Anyway, this definitely doesn't look like a stable planet, which is my ultimate goal. We need some collisions! What are our options?

# Bounding the force

The first idea is a bit silly: if the gravitational force becomes too high when the particles are close, why not just clamp it at some high enough value? For example, we can pretend that no two particles are closer than the sum of their radii, and use that in our force calculations:

{% highlight cpp %}
vec2 delta = particles[j].position - particles[i].position;
float min_distance = particles[j].radius + particles[i].radius;
float distance = max(min_distance, length(delta));
vec2 direction = delta / distance;

vec2 force = direction * G * particles[i].mass
    * particles[j].mass / pow(distance, 2.f);
{% endhighlight %}

which results in this:

<center><video width="600" muted controls><source src="{{site.url}}/blog/media/collisions/planet-clamped-force.mp4" type="video/mp4"></video></center>
<br/>

Still a mess, although a somewhat softer one. No more yeeting, but no stable planet either -- just a swarm of particles. Not fun.

# Merging particles

Another stupid idea (I think some old free gravity simulator for linux did that) is to simply merge particle into one upon collision:

{% highlight cpp %}
// somewhere after applying forces
// & integrating positions
for (size_t i = 0; i < particles.size(); ++i)
{
    for (size_t j = i + 1; j < particles.size(); ++j)
    {
        vec2 delta = particles[j].position - particles[i].position;
        if (length(delta) < particles[j].radius + particles[i].radius)
        {
            particle new_particle;
            new_particle.mass = particles[i].mass + particles[j].mass;
            new_particle.position = (particles[i].position * particles[i].mass
                + particles[j].position * particles[j].mass) / new_particle.mass;
            new_particle.velocity = (particles[i].velocity * particles[i].mass
                + particles[j].velocity * particles[j].mass) / new_particle.mass;
            // Make the total area of the resulting particle
            // equal to the sum of areas of the two particles
            new_particle.radius = sqrt(sqr(particles[i].radius) + sqr(particles[j].radius));

            particles[i] = new_particle;
            particles.erase(particles.begin() + j);
            break;
        }
    }
}
{% endhighlight %}

What we get is as dull as it gets:

<center><video width="600" muted controls><source src="{{site.url}}/blog/media/collisions/planet-merge.mp4" type="video/mp4"></video></center>
<br/>

# Force-based collisions

Ok, so we probably need some proper collisions and not some stupid hack. One of the ways to add collisions is to apply another force: if the particles are intersecting, i.e. the distance between them is smaller than the sum of their radii, apply a force that pushes the particles apart. Typically a spring-like force is used, proportional to the penetration distance:

{% highlight cpp %}
for (size_t i = 0; i < particles.size(); ++i)
{
    for (size_t j = i + 1; j < particles.size(); ++j)
    {
        vec2 delta = particles[j].position - particles[i].position;
        float sum_radii = particles[j].radius + particles[i].radius;
        float distance = length(delta);
        if (distance < sum_radii)
        {
            vec2 force = K * (sum_radii - distance) * (delta / distance);
            particles[i].velocity -= K * dt / particles[i].mass;
            particles[j].velocity += K * dt / particles[j].mass;
        }
    }
}
{% endhighlight %}

Here's what it looks like in my simulation with the spring constant K set to 10000:

<center><video width="600" muted controls><source src="{{site.url}}/blog/media/collisions/planet-force.mp4" type="video/mp4"></video></center>
<br/>

It seems to work in the beginning, but then it's a complete mess again. Since we're just applying a force to the colliding particles, it takes time to move them apart, meaning they can still happen to be too close and gain enormous accelerations due to gravity. We could make the time step Δt smaller, or the gravitational force G weaker, but that would make the simulation way too slow (not performance-wise, it's just that the interesting time scales will become too big). We could also make the collision force K stronger, which wouldn't resolve the problem but would also introduce yeeting due to the collision force being too strong (which we could fix by making the time step Δt smaller, which we don't wanna do). Making the collision force weaker doesn't help either -- now the gravitational yeeting is too strong. Et cetera, et cetera. This approach can definitely work in simple situations, as illustrated by [@KangarooPhysics](https://twitter.com/KangarooPhysics):

<center><blockquote class="twitter-tweet" data-lang="en"><a href="https://twitter.com/KangarooPhysics/status/1579406276395925504"></a></blockquote></center>

but it fails if we want a fast, interesting simulation. It also can't handle many particles, because at some point the gravitational force will become too strong and overcome the collision force (unless we always make the collision force stronger than gravity, in which case we've effectively canceled gravity and we're back at the "bounding gravity" solution). Here's what happens with a hundred particles after I stop artificially cooling them down (i.e. multiplying velocities by some 0.99 every iteration step):

<center><video width="600" muted controls><source src="{{site.url}}/blog/media/collisions/planet-force-cool.mp4" type="video/mp4"></video></center>
<br/>

Not good.

# Impulse-based collisions

Impulse-based constraints is what Erin Catto, creator of [Box2D](https://box2d.org), loves (or at least I think he does). [Here's his talk](https://ubm-twvideo01.s3.amazonaws.com/o1/vault/gdc09/slides/04-GDC09_Catto_Erin_Solver.pdf) on the matter.

Impulses (or, how physicists call them, momenta) are proportional to velocities and thus are first order derivatives of position with respect to time; forces, on the other hand, are second order. This implies a lot of things, but practically speaking impulses are usually simpler to work with, in part due to the discrete nature of our simulation. For example, if we want to pretend that collisions happen instantaneously, i.e. during a time period of zero seconds, we have to accept that the forces acting during this event are infinite, -- otherwise, a finite force can't change anything during such a time period. Needless to say, combining infinite forces and zero time period isn't something you want to do in a numerical simulation. The total collision impulse, however, will be finite and well-defined, and cares not about time periods.

The idea of impulse-based constraints goes like this: if you want to constrain the movement of a particle by an equation <img src="https://latex.codecogs.com/png.latex?%5Clarge%20f%28x%29%20%3D%200"/> (i.e. you want this equation to always hold) you differentiate it, apply [some stuff from theoretical mechanics](https://en.wikipedia.org/wiki/Virtual_work), derive some equations for the velocity (which happen to be linear), and the velocity delta is the impulse you need to apply to the particle so that the constraint is satisfied. Again, working with impulses rather then velocities simplifies the equations a lot (e.g. we have the law that [total momentum is conserved](https://en.wikipedia.org/wiki/Momentum#Conservation), but there's no such thing for velocities).

Collisions ain't of the form <img src="https://latex.codecogs.com/png.latex?%5Clarge%20f%28x%29%20%3D%200"/>, but rather <img src="https://latex.codecogs.com/png.latex?%5Clarge%20f%28x_1%2Cx_2%29%20%5Cgeq%200"/>, where <img src="https://latex.codecogs.com/png.latex?%5Clarge%20f"/> is the separation between two particles. Thus, on each iteration we check if the collisions constraint between two particles is satisfied: if it isn't, we need to solve it, otherwise we're already good. If we take the collision constraint <img src="https://latex.codecogs.com/png.latex?%5Clarge%20f%28x_1%2Cx_2%29%20%3D%20%7Cx_2-x_1%7C%20-%20R_1-R_2"/> and apply all the machinery from the talk linked above, we get something like this:

{% highlight cpp %}
// After applying forces, but before(!) integrating position
for (size_t i = 0; i < particles.size(); ++i)
{
    for (size_t j = i + 1; j < particles.size(); ++j)
    {
        vec2 delta = particles[j].position - particles[i].position;
        float sum_radii = particles[j].radius + particles[i].radius;
        float distance = length(delta);
        vec2 collision_normal = delta / distance;
        vec2 relative_speed = particles[j].velocity - particles[i].velocity;
        float constraint_speed = dot(collision_normal, relative_speed);
        if (distance < sum_radii && constraint_speed < 0.f)
        {
            float reduced_mass = 1.f / (1.f / particles[i].mass
                + 1.f / particles[j].mass);
            vec2 impulse = - collision_normal * constraint_speed * reduced_mass;
            particles[i].velocity -= impulse / particles[i].mass;
            particles[j].velocity -= impulse / particles[j].mass;
        }
    }
}
{% endhighlight %}

Quite the number of formulas, but this is more or less what any proper collision code will look like. It produces this:

<center><video width="600" muted controls><source src="{{site.url}}/blog/media/collisions/planet-impulse.mp4" type="video/mp4"></video></center>
<br/>

Collisions are definitely there, but it behaves like a drop of water in a pan full of boiling oil. There are two main problems here:
1. Collision resolution effectively cancels the relative velocity, but it doesn't prevent particles from penetrating into each other.
2. The particles stick to each other immediately upon collision, instead of moving in opposite directions, i.e. the collisions are perfectly inelastic, while I'd prefer to have some bouncing still present.

This first problem is known as *constraint drifting*: we wanted to solve the equation <img src="https://latex.codecogs.com/png.latex?%5Clarge%20f%28x%29%3D0"/>, but instead we solved <img src="https://latex.codecogs.com/png.latex?%5Clarge%20%5Cfrac%7Bd%7D%7Bdt%7D%20f%28x%29%3D0"/>, and due to discrete simulation the constraint got violated. We prevented it from going any worse *at this iteration* of simulation, but it can still get worse at the next one.

The way the impulse-based method solves this problem is called *baumgarte stabilization* (due to [Thomas W. Baumgarte](https://en.wikipedia.org/wiki/Thomas_W._Baumgarte), I believe, -- I didn't find a trustworthy source for that, though). Instead of solving <img src="https://latex.codecogs.com/png.latex?%5Clarge%20%5Cfrac%7Bd%7D%7Bdt%7D%20f%28x%29%3D0"/> we solve <img src="https://latex.codecogs.com/png.latex?%5Clarge%20%5Cfrac%7Bd%7D%7Bdt%7Df%28x%29%20%3D%20-%5Cfrac%7B%5Cbeta%7D%7B%5CDelta%20t%7Df%28x%29"/>, where <img src="https://latex.codecogs.com/png.latex?%5Clarge%200%20%5Cleq%20%5Cbeta%20%5Cleq%201"/> is some parameter that controls how strong is our desire for the constraints not to be violated. This leads to a small change to the code above:

{% highlight cpp %}
// After applying forces, but before(!) integrating position
for (size_t i = 0; i < particles.size(); ++i)
{
    for (size_t j = i + 1; j < particles.size(); ++j)
    {
        vec2 delta = particles[j].position - particles[i].position;
        float sum_radii = particles[j].radius + particles[i].radius;
        float distance = length(delta);
        vec2 collision_normal = delta / distance;
        vec2 relative_speed = particles[j].velocity - particles[i].velocity;
        float constraint_speed = dot(collision_normal, relative_speed);
        float constraint_value = distance - sum_radii;
        if (constraint_value < 0.f && constraint_speed < 0.f)
        {
            float reduced_mass = 1.f / (1.f / particles[i].mass
                + 1.f / particles[j].mass);
            vec2 impulse = collision_normal * (- constraint_speed
                - bias / dt * constraint_value) * reduced_mass;
            particles[i].velocity -= impulse / particles[i].mass;
            particles[j].velocity -= impulse / particles[j].mass;
        }
    }
}
{% endhighlight %}

where `bias` is the β value. Here's how it looks with β=0.125:

<center><video width="600" muted controls><source src="{{site.url}}/blog/media/collisions/planet-impulse-bias-soft.mp4" type="video/mp4"></video></center>
<br/>

with β=0.5:

<center><video width="600" muted controls><source src="{{site.url}}/blog/media/collisions/planet-impulse-bias.mp4" type="video/mp4"></video></center>
<br/>

and with β=1.0:

<center><video width="600" muted controls><source src="{{site.url}}/blog/media/collisions/planet-impulse-bias-hard.mp4" type="video/mp4"></video></center>
<br/>

If β is too small, it explodes due to failing to prevent huge penetration. If β is too large, collisions are too stiff and the collision impulse is too large, so the thing still boils and explodes a bit. Some middle value of 0.5 seems OK, although the center of the "planet" still boils and seems like it just wants to explode.

Another thing we can do is add more solver iterations! One iteration of simulation will have several iterations of collision resolution. It isn't completely trivial, though: we need to keep track of accumulated collision impulses over several solver iterations and clamp them after each iteration, properly updating the velocities using the differences between those clamped values. I won't show the full code, since it gets a bit involved; all this is explained in the talk by Erin Catto that I linked above.

Let's see what we get if we vary β and the number of iterations:

<center><video width="600" muted controls><source src="{{site.url}}/blog/media/collisions/planet-impulse-bias-iterative.mp4" type="video/mp4"></video></center>
<br/>

So, increasing the number of iterations increases stability, but still too high values of β make the simulation "boil", medium values make it jitter a lot, and low values make it behave like a sponge. A planet made of sponge is fun, but far from what I wanted.

Let's also address the second issue: how do we make the collisions elastic? This is pretty simple -- we just add the extra velocity to the bias:

{% highlight cpp %}
// After applying forces, but before(!) integrating position
for (size_t i = 0; i < particles.size(); ++i)
{
    for (size_t j = i + 1; j < particles.size(); ++j)
    {
        vec2 delta = particles[j].position - particles[i].position;
        float sum_radii = particles[j].radius + particles[i].radius;
        float distance = length(delta);
        vec2 collision_normal = delta / distance;
        vec2 relative_speed = particles[j].velocity - particles[i].velocity;
        float constraint_speed = dot(collision_normal, relative_speed);
        float constraint_value = distance - sum_radii;
        if (constraint_value < 0.f && constraint_speed < 0.f)
        {
            float reduced_mass = 1.f / (1.f / particles[i].mass
                + 1.f / particles[j].mass);
            vec2 impulse = collision_normal * (- constraint_speed *
                (1.f + elasticity) - bias / dt * constraint_value) * reduced_mass;
            particles[i].velocity -= impulse / particles[i].mass;
            particles[j].velocity -= impulse / particles[j].mass;
        }
    }
}
{% endhighlight %}

`elasticity` is the parameter controlling how bouncy our particles are: for `elasticity = 0` we get our old inelastic collisions, for `elasticity = 1` we get perfectly elastic collisions (and, in theory, full conservation of energy). This is how it looks with 16 solver iterations, β = 1/8 and `elasticity = 0.75`:

<center><video width="600" muted controls><source src="{{site.url}}/blog/media/collisions/planet-impulse-elastic.mp4" type="video/mp4"></video></center>
<br/>

Not great: having many solver iterations effectively cancels elasticity, sadly.

Overall, the approach works for small systems, but not for our huge 500-particle self-gravitating blob. Duh.

# Position-based collisions

We've tried second-order (force) collisions and they didn't work. We've also tried first-order (impulse) collisions and they worked a bit better but still far from ideal. What goes after 2 and 1? Zero, of course.

The zero-th derivative of position is position itself. It's also surprisingly simple to resolve collisions on the position level: just move the particles apart!

{% highlight cpp %}
// After applying forces and integrating position
for (size_t i = 0; i < particles.size(); ++i)
{
    for (size_t j = i + 1; j < particles.size(); ++j)
    {
        vec2 delta = particles[j].position - particles[i].position;
        float sum_radii = particles[j].radius + particles[i].radius;
        float distance = length(delta);
        vec2 collision_normal = delta / distance;
        vec2 relative_speed = particles[j].velocity - particles[i].velocity;
        float constraint_speed = dot(collision_normal, relative_speed);
        float constraint_value = distance - sum_radii;
        if (constraint_value < 0.f && constraint_speed < 0.f)
        {
            vec2 offset = constraint_value * collision_normal;
            float total_mass = particles[i].mass + particles[j].mass;
            particles[i].position += offset * particles[j].mass / total_mass;
            particles[j].position += offset * particles[i].mass / total_mass;
        }
    }
}
{% endhighlight %}

Note that we move each particle in proportion to the *other* particle's mass. Intuitively, if a large particle collides with a small one, the small particle should have more impact.

<center><video width="600" muted controls><source src="{{site.url}}/blog/media/collisions/planet-position-naive.mp4" type="video/mp4"></video></center>
<br/>

Collisions are definitely happening, but something's not right: we don't update velocities after collisions, and they definitely should've changed. Let's properly compute the collision impulse and apply it to the colliding particles:

{% highlight cpp %}
// After applying forces and integrating position
for (size_t i = 0; i < particles.size(); ++i)
{
    for (size_t j = i + 1; j < particles.size(); ++j)
    {
        vec2 delta = particles[j].position - particles[i].position;
        float sum_radii = particles[j].radius + particles[i].radius;
        float distance = length(delta);
        vec2 collision_normal = delta / distance;
        vec2 relative_speed = particles[j].velocity - particles[i].velocity;
        float constraint_speed = dot(collision_normal, relative_speed);
        float constraint_value = distance - sum_radii;
        if (constraint_value < 0.f && constraint_speed < 0.f)
        {
            float total_mass = particles[i].mass + particles[j].mass;
            float reduced_mass = 1.f / (1.f / particles[i].mass
                + 1.f / particles[j].mass);

            vec2 offset = constraint_value * collision_normal;
            particles[i].position += offset * particles[j].mass / total_mass;
            particles[j].position += offset * particles[i].mass / total_mass;

            vec2 impulse = collision_normal * (- constraint_speed
                * (1.f + elasticity)) * reduced_mass;
            particles[i].velocity -= impulse / particles[i].mass;
            particles[j].velocity -= impulse / particles[j].mass;
        }
    }
}
{% endhighlight %}

Phew, that's a lot of code for such a simple thing. Here's what it looks like for `elasticity = 0.25`:

<center><video width="600" muted controls><source src="{{site.url}}/blog/media/collisions/planet-position-simple.mp4" type="video/mp4"></video></center>
<br/>

Not good again. What if we simply run the whole solver for several iterations? Here's what 16 iterations looks like:

<center><video width="600" muted controls><source src="{{site.url}}/blog/media/collisions/planet-position-iterative.mp4" type="video/mp4"></video></center>
<br/>

No explosions, collisions are stiff, and the "boiling" of the planet's "core" is sufficiently reduced! But it *spins*. Even worse: *it spins with acceleration*.

The reason for this spinning is quite involved; in short, the (apply gravity -> integrate velocity -> integrate positions -> solve collisions) loop works in such a delicate way that it always enhances any preexisting rotation. And there always will be pre-existing rotation due to numerical errors.

In case you think that the reason is the order in which the collisions are resolved, that's not the case. I tried adding a small rotation from the start -- the algorithm always enhances this specific rotation. I tried accumulating the collision offsets & impulses separately and then applying them to the particles, so that the order cannot matter, -- and it still spins. I even tried randomly permuting the particles on every iteration, and it still spins.

# Position-based collisions with Verlet integration

There's another trick we didn't try: Verlet integration. Instead of doing

{% highlight cpp %}
for (size_t i = 0; i < particles.size(); ++i)
    particles[i].velocity += particles[i].force * dt / particles[i].mass;

for (size_t i = 0; i < particles.size(); ++i)
    particles[i].position += particles[i].velocity * dt;
{% endhighlight %}

Verlet integration suggests doing this:

{% highlight cpp %}
for (size_t i = 0; i < particles.size(); ++i)
{
    vec2 position = particles[i].position;
    particles[i].position += (particles[i].position - particles[i].old_position)
        + particles[i].force * dt * dt / particles[i].mass;
    particles[i].old_position = position;
}
{% endhighlight %}

which is provably equivalent to the previous option, but is also more precise (the numerical error of integration is smaller by an order). It also doesn't require us to keep track of velocities, but we need to know the position of the particle on the previous simulation frame. In practice it is sometimes convenient to keep track of both, and do `velocity = (position - old_position) / dt` at the end of the frame.

We use the same position-based collision resolution code that ignores velocities:

<center><video width="600" muted controls><source src="{{site.url}}/blog/media/collisions/planet-verlet.mp4" type="video/mp4"></video></center>
<br/>

The collisions are stiff, but it kinda explodes. Again, let's try running the same collision solver for 16 iterations every frame:

<center><video width="600" muted controls><source src="{{site.url}}/blog/media/collisions/planet-verlet-iterative.mp4" type="video/mp4"></video></center>
<br/>

Looks great, doesn't it? Stiff collisions, a stable planet, no explosions, no sponges, no boiling.

Except is *spins*. Again.

# Event-based collisions

I've heard of another, much more complicated method. Consider a simple symplectic Euler base simulation. After we've applied forces, the velocities don't change during this iteration (except due to collisions), meaning all the balls move in straight lines. Given two such balls, we can compute the exact time when they collide, if they do! So, we do the following:

1. Apply the forces
2. Compute all pairwise collisions that can happen during this simulation step (i.e. that happen before Δt seconds)
3. Pick the soonest collision
4. Resolve it (compute new velocities)
5. Compute new possible collisions with this two particles
6. Repeat from step 3 until no new collisions are found

If this sounds involved, it's because it is. There are a few nasty cases with collisions happening in the past, infinite loops, etc. I refer you to [these](https://link.springer.com/content/pdf/10.1007/s40571-014-0021-8.pdf) [two](https://arxiv.org/pdf/2201.01100.pdf) papers on this algorithm.

After successfully defeating all the problems, I got this:

<center><video width="600" muted controls><source src="{{site.url}}/blog/media/collisions/planet-event.mp4" type="video/mp4"></video></center>
<br/>

This is perfect, quite literally. Stiff collisions, no explosions, no boiling, not sponging, nothing. And it *doesn't spin*. I've left the simulation for really long times & it still doesn't spin.

The only problem is that it is slow as hell, as you can probably see in the video. Huge blobs of sticked particles cause an enormous number of collisions, all of which happen over tiny time periods. Based on numerical results, there are on average something like `0.1 * N^2` collisions per simulation frame, where `N` is the number of particles. I'm yet to find a solution for this.

Still, I'm very satisfied with what this algorithm does. Look at how beautifully it manages to tear a planet apart with an incoming comet:

<center><video width="600" muted controls><source src="{{site.url}}/blog/media/collisions/planet-event-comet.mp4" type="video/mp4"></video></center>
<br/>

No other algorithm I've tested could accomplish that. With most other algorithms the comet just flies through the planet (like with force-based collisions) or collides in a strange and unnatural way (impulse-based).

# Conclusion

Simulating physics is really hard, and no approach suits every purpose. I'm still hoping to find a better way to simulate all this; maybe this article will have a sequel then.