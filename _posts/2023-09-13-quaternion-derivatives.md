---
layout: post
title:  "Quaternion derivatives"
date:   2023-09-13 14:00:00 +0300
categories: math
mathjax: yes
steamwidgets: yes
---

<script async="" src="//platform.twitter.com/widgets.js" charset="utf-8"></script>

This is a follow-up to my earlier [post about complex derivatives](https://lisyarus.github.io/blog/math/2023/08/03/complex-derivatives.html). I was hoping to use it for something like inverse kinematics, and I fot some relatively nice formulas, but it all worked in 2D. For 3D inverse kinematics we want [quaternions](https://en.wikipedia.org/wiki/Quaternion)! So, can we find a way to differentiate quaternions the same way we did with complex numbers, and use this for inverse kinematics? The answer is probably no, but we'll learn a lot about quaterions along the way.

* TOC
{:toc}

# Derivatives

Recall that the derivative $$f'$$ is just a first-order correction to a function's value around a point:

\\[ f(x+\delta) = f(x) + f'(x) \cdot \delta + o(\delta) \\]

where $$o(\delta)$$ is something that goes to zero faster than $$\delta$$ when $$\delta$$ itself goes to zero, something like $$\delta^2$$ of $$\delta^3$$.

So, how do we differentiate quaternions? Let's tackle a few simpler cases first.

# Functions $$\mathbb R \rightarrow \mathbb H$$

Say you have a function $$f$$ that takes a real number $$t\in\mathbb R$$ and outputs a quaternion $$q\in\mathbb H$$:

\\[ q = f(t) \\]

_By the way, quaternions are denoted as $$\mathbb H$$ in honour of their discoverer, [William Hamilton](https://en.wikipedia.org/wiki/William_Rowan_Hamilton)._

This can be a function that specifies an object's rotation over time, or it may be a quaternionic spline like this one by Freya Holmér:

<center><blockquote class="twitter-tweet" data-lang="en"><a href="https://twitter.com/FreyaHolmer/status/1700859336971485645"></a></blockquote></center>

How do we differentiate such a thing? Well, simply treat quaternions as a four-dimensional space $$\mathbb R^4$$. The derivative is then just a vector formed by componentwise differentiation. For example, if

\\[ f(t) = t + t^2\cdot i + 3 \cdot j + \sin(t) \cdot k\\]

then the derivative is as you'd expect

\\[ f'(t) = 1 + 2t\cdot i + 0 \cdot j + \cos(t) \cdot k\\]

Here, $$i$$, $$j$$ and $$k$$ are the basis *quaternions* (together with $$1$$ they form the basis of the 4-dimensional space of quaternions).

Usually, quaternions are normalized, because only such quaternions represent rotations (_this isn't strictly true, as you'll see in the next section_). So, in this case $$\|f(t)\|^2 = 1$$, which is the same as $$\langle f(t), f(t) \rangle = 1$$. Here, $$\langle \cdot,\cdot \rangle$$ is the usual dot product, i.e. the sum of pairwise coordinate products. I'm using a special notation here so that we don't mix it with the quaternion multiplication $$q\cdot q$$.

If we differentiate this equation, we get

\\[ \frac{d}{dt}\langle f(t), f(t) \rangle = \frac{d}{dt} 1 \\]
\\[ \langle f'(t) , f(t) \rangle + \langle f(t) , f'(t) \rangle = 0 \\]
\\[ 2\langle f'(t) , f(t) \rangle = 0 \\]
\\[ \langle f'(t) , f(t) \rangle = 0 \\]

Which means that the derivative $$f'(t)$$ is orthogonal to the quaternion itself $$f(t)$$. This happens every time you differentiate a normalized vector, in any dimension! It means that the vectors tangent to a sphere at a specific point are orthogonal to the vector from the center of the sphere to this point.

# Should I normalize quaternions?

We're always told that quaternions should be normalized when we use them to represent rotations, and we absolutely should, but I just wanted to show a few other points of view :)

Firstly, quaternions are really a special case of [Clifford algebras](https://en.wikipedia.org/wiki/Clifford_algebra), which are among my favourite objects in mathematics, generalizing complex numbers & quaternions, and which are the basis for [geometric algebra](https://en.wikipedia.org/wiki/Geometric_algebra). Specifically, quaternions are *the even subalgebra of the clifford algebra $$\operatorname{Cl}(\mathbb R^3)$$ of the 3D Euclidean space,* and this is exactly why they are related to rotations of this space.

Clifford algebras can be used to represent rotations in any dimensions, though their structure gets [more complicated](https://en.wikipedia.org/wiki/Classification_of_Clifford_algebras) as the dimension grows _(but [not too complicated](https://en.wikipedia.org/wiki/Bott_periodicity_theorem))_. The [usual formula](https://en.wikipedia.org/wiki/Clifford_algebra#Lipschitz_group) for this looks something like 

\\[ x \mapsto q \cdot x \cdot q^{-1} \\]

where $$x$$ is the rotated vector, and $$q$$ is an element of the Clifford algebra (actually from the [Clifford-Lipschitz group](https://en.wikipedia.org/wiki/Clifford_algebra#Lipschitz_group); I've also ignored one thing which isn't relevant for us). Notice that we have a $$q^{-1}$$ here. If we multiply $$q$$ by some number $$s$$, we get

\\[ x \mapsto sq \cdot x \cdot (sq)^{-1} = (s\cdot s^{-1}) \cdot q \cdot x \cdot q^{-1}  = q \cdot x \cdot q^{-1} \\]

_(this only works because numbers [commute](https://en.wikipedia.org/wiki/Commutative_property) with everything)._

So, the resulting vector doesn't change, and a single rotation can be represented by many different elements of the Clifford algebra. This makes things easier to analyse mathematically, and there is no need to normalize $$q$$ here.

However, the formula we use for rotations using quaternions is usually

\\[ x \mapsto q \cdot x \cdot \overline q \\]

where $$\overline q$$ is the conjugate quaternion. Why change the formula? Well, the formula for an inverse quaternion involves the conjugate anyway:

\\[ q^{-1} = \frac{\overline q}{\|q\|^2} \\]

so we can save a few operations by stating that $$\|q\|=1$$ always, and use a computationally simpler formula instead.

The second point of view is that you can actually use non-normalized quaternions to represent uniform scaling! If, again, we scale our quaternion by a number, but use the usual rotation formula (the one without the inverse), we get

\\[ x \mapsto sq \cdot x \cdot \overline{sq} = (s\cdot\overline s)\cdot q \cdot x \cdot \overline q = s^2 \cdot q \cdot x \cdot \overline q \\]

because numbers are their own conjugates in the quaternion algebra. Scaling a quaternion by $$s$$ effectively encodes the operation of uniform scaling by $$s^2$$. So, we can have our quaternions non-normalized, but instead multiply them by $$\sqrt{scale}$$, and maybe save on sending some data to the GPU. This doesn't work at all for non-uniform scaling, though.

# Functions $$\mathbb H \rightarrow \mathbb R$$

Let's reverse things a bit: now we have a function that takes a quaternion and outputs a number instead. How do we differentiate it? Same idea -- treat quaternions $$\mathbb H$$ as a 4-dimensional space $$\mathbb R^4$$, then compute the gradient of your function. For example, if

\\[ f(q) = \|q\|^2 \\]

where $$q = w + xi + yj + zk$$, then

\\[ f(q) = w^2 + x^2 + y^2 + z^2 \\]

and 

\\[ \nabla f = \begin{pmatrix}\frac{\partial f}{\partial w} \\\\ \frac{\partial f}{\partial x} \\\\ \frac{\partial f}{\partial y} \\\\ \frac{\partial f}{\partial z} \end{pmatrix} = \begin{pmatrix} 2w \\\\ 2x \\\\ 2y \\\\ 2z \end{pmatrix} = 2q \\]

_The true derivative is not the gradient but the [differential](https://en.wikipedia.org/wiki/Differential_(mathematics)#Differential_geometry), while the gradient is the differential with [lowered indices](https://en.wikipedia.org/wiki/Musical_isomorphism). If anyone asks, I didn't tell you that._

Nothing really special here. As usual, this gradient quaternion tells you the direction of the function's fastest growth, and the speed of that growth.

Let's get to the meat of this post.

# Functions $$\mathbb H \rightarrow \mathbb H$$

Nothing special here at first glance as well. We have a function that takes a quaternion and outputs a quaternion; treat both the input and output as 4-dimensional vectors $$\mathbb R^4$$, compute the _Jacobian matrix_, and that's your derivative, end of story.

Except we'd want something more! Remember how with complex numbers, we could say things like $$(z^2)' = 2z$$ and $$(z^3)=3z^2$$ in a very precise way, because the Jacobian was very special: it was the _matrix of multiplying by a complex number_.

Let's try this with quaternions! Say that a function is *quaternion-differentiable* if it's Jacobian matrix $$J$$ is the matrix of multiplication by a quaternion: $$J\delta = r\cdot\delta$$ for some quaternion $$r\in\mathbb H$$ (which depends on the input $$q$$ but not on the offset $$\delta$$). Recall that the Jacobian is just a fancy name for the derivative of a function $$\mathbb R^m \rightarrow \mathbb R^n$$:

\\[ f(x+\delta) = f(x) + J\delta + o(\delta) \\]

 _I wonder if you already see a problem here :)_

How do we know that a matrix has this form? We could either take a quaternion $$r=a + bi + cj + dk$$ and see how it behaves when we multiply it with a generic quaternion, or we could look up the [wikipedia page](https://en.wikipedia.org/wiki/Quaternion#Matrix_representations). Either way, we get something like

\\[ J = \begin{pmatrix} a & -b & -c & -d \\\\ b & a & -d & c \\\\ c & d & a & -b \\\\ d & -c & b & a \end{pmatrix} \\]

See how this matrix is quite special, e.g. the diagonal contains the same value, while the non-diagonal part is anti-symmetic, etc. If the Jacobian of our function looks like this, it is differentiable!

Let's check our definition on the simplest possible example: the function $$f(q) = q^2$$. In coordinates, the square of a quaternion is quite funny: if $$q = w + xi + yj + zk$$, then

\\[ q^2 = (w^2 - x^2 - y^2 - z^2) + 2wx\cdot i + 2wy \cdot j + 2wz \cdot k \\]

Now, the Jacobian matrix (the matrix of partial derivatives of each coordinate by each coordinate) is

\\[ J = \begin{pmatrix} 2w & -2x & -2y & -2z \\\\ 2x & 2w & 0 & 0 \\\\ 2y & 0 & 2w & 0 \\\\ 2z & 0 & 0 & 2w \end{pmatrix} \\]

This matrix is really close to what we need, -- it has a single value on the diagonal and the off-diagonal part is anti-symmetric, -- but it is still _not_ of the form we need. So, $$q^2$$ isn't differentiable! This doesn't mean $$q^2$$ is a bad function; it means _our definition of derivaties_ is bad.

# Noncommutativity

You might've already suspected why we have problems. We defined a function differentiable if its Jacobian is of the form $$J\delta = r\cdot\delta$$ for some quaternion $$r$$. But quaternion multiplication is not commutative, meaning $$r\cdot\delta \neq \delta \cdot r$$ in general! So why don't we take $$J\delta = \delta \cdot r$$ as the definition instead?

Well, this won't help us either: $$q^2=q\cdot q$$ will still be non-differentiable, because, loosely speaking, it is multiplying the input quaternion both from the left and from the right.

How do we fix that? Let's return to the basics: we have a Jacobian matrix, and we want to find a nice enough expression for it in terms of algebraic operations with quaternions. In complex numbers, we fixed that by also allowing a $$\overline z$$ term in the derivative. This will hardly help us here, partially because the quaternionic conjugate [_can be expressed_](https://en.wikipedia.org/wiki/Quaternion#Conjugation,_the_norm,_and_reciprocal) through usual quaternion arithmetics:

\\[ \overline q = -\frac{1}{2}(q +iqi +jqj +kqk) \\]

This expression, although not being a derivative by itself, gives us a hint on what we need to do:

1. Allow multiplication both from the left _and_ from the right: $$J\delta = l\cdot\delta \cdot r$$ for some quaternions $$l$$ and $$r$$
2. Allows sums of expressions like this: $$J\delta = \sum l_i \cdot \delta \cdot r_i$$

It turns out that _any 4x4 matrix_ acting on a quaternion $$\delta$$ can be expressed in the form $$\sum l_i \cdot \delta \cdot r_i$$. If you think this isn't bonkers, consider this: it _is not true_ for complex numbers! In fact, since complex numbers are commutative, this expression would be just 

\\[ \sum l_i\cdot \delta \cdot r_i = \sum \delta  \cdot l_i \cdot r_i = \delta  \cdot \left(\sum l_i \cdot r_i\right) \\]

which is just multiplication by the complex number $$\sum l_i \cdot r_i$$, and we've spend a good part of the previous post discussing how this only works for half of all the 2x2 matrices.

So, quaternions are somehow very special. This is because they form a [*central simple algebra (CAS)*](https://en.wikipedia.org/wiki/Central_simple_algebra), or, more generally, an [Azumaya algebra](https://en.wikipedia.org/wiki/Azumaya_algebra).

# Central simple algebras

This is a very cool and incredibly important concept from algebra which is rarely taught to non-mathematicians. Fix your base field of scalars, -- for example, the real numbers $$\mathbb R$$. An *algebra* is just some set of elements that you can add, subtract, and multiply, which contains the scalars and obeys the usual rules of arithmetics. We say an algebra is defined _over_ it's field of scalars. 

You've seen many algebras in your life. Polynomials with real coefficients $$\mathbb R[X]$$ are an algebra *over* the real numbers $$\mathbb R$$. Real-valued $$N\times N$$ matrices $$M_N(\mathbb R)$$ are an algebra *over* real numbers $$\mathbb R$$. Complex numbers $$\mathbb C$$ are an algebra *over* real numbers $$\mathbb R$$. Real numbers themselves $$\mathbb R$$ are an algebra *over* the rational numbers $$\mathbb Q$$! 

A *simple* algebra means something technical, but you can think of it as not being decomposable into smaller pieces *(in terms of a [short exact sequence](https://en.wikipedia.org/wiki/Exact_sequence))*. A *central* algebra is one where the scalars are the only guys who commute with everything, i.e. if for some element $$a$$ we have $$ax=xa$$ for any $$x$$ from the algebra, then this $$a$$ must be a scalar from the base field.

Quaternions are a central simple algebra, when the base field is the real numbers $$\mathbb R$$. The complex numbers $$\mathbb C$$, however, are *not central* over $$\mathbb R$$: in fact, they are commutative, so *all* elements commute with all others, not just the real scalars. This is why the trick with matrices doens't work for complex numbers: they are *simple*, but *not central*.

By the way, the complex numbers $$\mathbb C$$ *are* a central simple algebra *over themselves*, i.e. if we consider complex numbers to be scalars instead of real numbers. Any field is a CAS over itself, which is a boring fact that won't help us in any way. *(Explaining why the choice of scalars matters would take a long detour into abstract algebra; I'll just note that it has to do with [tensor products](https://en.wikipedia.org/wiki/Tensor_product).)*

In fact, quaternions $$\mathbb H$$ are *the only* central simple algebra over the real numbers $$\mathbb R$$ other than the real numbers themselves! So they are really, *really*, ***really*** special. (*We only consider finite-dimensional algebras here.)*

Now, the thing about representing matrices is true for any central simple algebra $$\mathbb A$$: any linear operator $$L : \mathbb A \rightarrow \mathbb A$$ can be represented as

\\[ Lx = \sum a_i x b_i \\]

for some elements $$a_i, b_i \in \mathbb A$$ from this algebra. Formally, this establishes an algebra isomorphism

\\[ \operatorname{End}(\mathbb A) \cong A \otimes A^{op} \\]

where $$\operatorname{End}$$ is the set of linear operators and $$A^{op}$$ is the [opposite algebra](https://en.wikipedia.org/wiki/Opposite_ring).

*It's okay if you didn't understand a single word in this section, just move on!*

# Quaternionic analysis

_Yes, this is a real [field of study](https://en.wikipedia.org/wiki/Quaternionic_analysis)._

Let's see how all this helps us. What on Earth is the derivative of $$q^2$$?

Sadly, we need to ditch the idea that the derivative is again a quaternion. It is a general linear map; all we can hope is to find a nice expression of the form we've discussed above.

To find such an expression, let's replace $$q$$ with $$q + \delta$$ and treat $$\delta$$ as very small:

\\[ (q+\delta)^2 = q^2 + q\cdot \delta + \delta \cdot q + \delta^2 \\]

So, we get the function's value $$q^2$$, the linear correction term $$q\cdot \delta + \delta \cdot q$$ and something that is too small to care $$\delta^2$$. The linear correction term _is_ our derivative!

We can rewrite it in a slightly funnier way be replacing $$\delta$$ by $$dq$$ and pretending it is some sort of differential of $$q$$:

\\[ (q^2)' = q\cdot dq + dq \cdot q \\]

Now this is some good formula! It tells us exactly what we need: how exactly the function $$q^2$$ changes when we move from $$q$$ in the direction $$dq$$.

We can compute some more stuff now, like the derivative of multiplying be a fixed quaternion $$a$$:

\\[ (aq)' = a\cdot dq \\]
\\[ (qa)' = dq\cdot a \\]

or the derivative of $$q^3$$ by expanding

\\[ (q+dq)^3 = q^3 + q^2\cdot dq + q\cdot dq \cdot q + q \cdot dq^2 + dq \cdot q^2 + dq \cdot q \cdot dq + dq^2 \cdot q + dq^3 \\]

so, gathering only the terms linear in $$dq$$, we get the derivative

\\[ (q^3)' = q^2\cdot dq + q\cdot dq \cdot q + dq \cdot q^2 \\]

You can probably already guess that

\\[ (q^4)' = q^3\cdot dq + q^2\cdot dq \cdot q + q\cdot dq \cdot q^2 + dq \cdot q^3 \\]

and so on for $$(q^n)'$$. We can even differentiate $$q^{-1}$$ by using the identity $$q\cdot q^{-1} = 1$$:

\\[ (q+dq) \cdot (q+dq)^{-1} = 1 \\]
\\[ (q + dq) \cdot (q^{-1} + Jdq + o(dq)) = 1 \\]
\\[ q\cdot q^{-1} + q\cdot Jdq + dq \cdot q^{-1} + dq \cdot Jdq = 1 \\]

Use $$q\cdot q^{-1}=1$$ and ignore higher-order terms:

\\[ q\cdot Jdq + dq \cdot q^{-1}  = 0 \\]
\\[ q\cdot Jdq = - dq \cdot q^{-1} \\]
\\[ Jdq = - q^{-1} \cdot dq \cdot q^{-1} \\]

So
\\[ (q^{-1})' = - q^{-1} \cdot dq \cdot q^{-1} \\]

We could try to differentiate some analytic functions like $$\exp$$ or $$\sin$$ using their Taylor series, but I guess it becomes a bit complicated.

# Arbitrary algebras

Note that the formulas we've developed above didn't really use the fact that $$q$$ is a quaternion. Sure, we *did* use the fact that *any* derivative can be represented this way, but we don't need this fact for the derivative of a *specific function*.

For example, all the formulas above work for matrices instead of quaternions. See for example [this post](https://math.stackexchange.com/questions/1471825/derivative-of-the-inverse-of-a-matrix) about the derivative of an inverse matrix -- we get literally the same formula, just with a slight difference in notation.

So, if you can derive a formula for a derivative like what we did in the previous section, this formula works *in any algebra*, not just for matrices or quaternions! Cool, huh.

# Inverse kinematics?

Is all this useful for inverse kinematics? Sadly, I doubt it. Even for the simplest toy problem of figuring out the orientation $$q$$ of a robot arm that points in a fixed direction $$c$$, we'd minimize 

\\[ \|qi\overline q-c\|^2 = (qi\overline q-c)\overline{(qi\overline q-c)} \\]

and then use the [formula](https://lisyarus.github.io/blog/math/2023/09/13/quaternion-derivatives.html#noncommutativity) for $$\overline q$$ we mentioned before. We'd get a very large expression which is hardly useful compared to just computing the 3D vector $$qi\overline q$$ explicitly in coordinates and minimizing $$\|qi\overline q-c\|^2$$ as usual.

Still, I hope you've learned something new and fun!

{% include end_section.html %}