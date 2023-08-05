---
layout: post
title:  "Complex numbers, Wirtinger derivatives and 2D inverse kinematics"
date:   2023-08-03 18:00:00 +0300
categories: math
mathjax: yes
steamwidgets: yes
---

Recently, I've been thinking about [inverse kinematics](https://en.wikipedia.org/wiki/Inverse_kinematics) for a certain project which I might be doing somewhere in the future. Around the same time, [a friend of mine](https://twitter.com/JustSlavic) asked me something about complex derivatives. In the end I decided to write this post to clear my own thoughts and to hopefully explain something useful :)

# Ordinary derivatives

Let's start with simple derivatives of single-valued real functions of a single real variable $$\mathbb{R} \rightarrow \mathbb{R}$$. The derivative is something something rate of change something something limit:

\\[ f'(x) = \lim\limits_{\delta\rightarrow 0} \frac{f(x+\delta) - f(x)}{\delta} \\]

I never liked this definition. Or, rather, this way of writing down the definition. What I like is, essentially, the Taylor series up to first degree with the [remainder in Peano form](https://en.wikipedia.org/wiki/Taylor%27s_theorem#Taylor's_theorem_in_one_real_variable), which is equivalent to the usual definition:

\\[ f(x+\delta) = f(x) + f'(x) \cdot \delta + o(\delta) \\]

That is, if the function can be locally expanded as a constant $$f(x)$$ plus some number $$f'(x)$$ times the offset $$\delta$$ up to terms of higher order $$o(\delta)$$, then this number $$f'(x)$$ is the derivative. Notice that $$f'(x)$$ can depend on $$x$$, but *not* on $$\delta$$. This is important.

# Function of several variables

(Not) incidentally, the definition almost doesn't change if we talk about the gradient of a function of several variables:

\\[ f(x+\delta) = f(x) + \nabla f \cdot \delta + o(\delta) \\]

Here, $$x$$ and $$\delta$$ are vectors, $$\nabla f$$ is also a vector, and $$\cdot$$ is now the dot product. If a function admits such an expansion, $$\nabla f$$ is the derivative (*or, rather, the gradient -- the true derivative is more like the transpose $$(\nabla f)^T$$ -- these things matter when you move from Euclidean spaces to general manifolds*). Again, $$\nabla f$$ depends on $$x$$ but *not* on $$\delta$$, which forces the extra correction $$\nabla f \cdot \delta$$ to be a *linear* function of $$\delta$$.

Notice how the definition using the limit of a fraction would be problematic here: we'd have to divide a number by a vector, and I have no idea how to do that! *This is possible in Clifford/geometric algebra, but it's not the type of division we need here.*

# Algebraic derivatives

By the way, there are ways to define derivatives purely algebraically. The core of this definition is the Leibniz rule:

\\[ D(f\cdot g) = D(f) \cdot g + f \cdot D(g) \\]

where $$D$$ is the differentiation operator. Such things are called [*derivations*](https://en.wikipedia.org/wiki/Derivation_(differential_algebra)) in algebra. If we restrict our attention to, say, polynomials of one variable, we can derive the formula

\\[ D(x^2) = D(x\cdot x) = D(x)\cdot x + x\cdot D(x) = 2xD(x) \\]

and in general

\\[ D(x^{n+1}) = D(x \cdot x^n) = D(x) \cdot x^n + x \cdot D(x^n) \\]

which by induction leads to

\\[ D(x^n) = nx^{n-1}D(x) \\]

and since derivatives are always linear, we get

\\[ D(p(x)) = D\left(\sum a_k x^k\right) = \left(\sum k a_k x^{k-1}\right) \cdot D(x) = p'(x) \cdot D(x) \\]

so any *derivation* on the algebra of polynomials is completely determined by the value $$D(x)$$ and equals the usual derivative followed by multiplication by whatever polynomial $$D(x)$$ is equal to:

\\[ D = D(x) \cdot \frac{d}{dx} \\]

In particular, setting $$D(x) = 1$$ and the Leibniz rule is enough to define the usual derivative without any limits. In general, derivations in some algebra of functions correspond to first-order differential operators on these functions. Only works for stuff that is nice algebraically (e.g. polynomials), though :)

# Leibniz rule

Let me make another digression. The Leibniz rule is true for any sensible definition of a (first-order) derivative, but it is also true for any reasonable definition of a product! This equation is true

\\[ \frac{d}{dt}(A\cdot B) = \frac{dA}{dt}\cdot B + A\cdot \frac{dB}{dt} \\]

regardless of whether $$A, B$$ are numbers (number-valued functions, that is), vectors, quaternions, or matrices, and whether this dot $$\cdot$$ means number multiplication, vector dot product, quaternion multiplciation, or matrix multiplication. Stating this a bit more formally and generally, the Leibniz rule applies to any *bilinear operator* $$\phi$$:

\\[ \frac{d}{dt}\phi(A, B) = \phi\left(\frac{dA}{dt}, B\right) + \phi\left(A, \frac{dB}{dt}\right) \\]

Here, *bilinear* means $$\phi(xA+yB, C) = x\phi(A,C) + y\phi(B,C)$$ (and a similar equation for the second argument) for any numbers $$x, y$$ and any *objects* $$A, B, C$$ that the derivative is defined for.

# Several functions of several variables

Back to the core of this post. Say we have a function $$f: \mathbb{R}^n \rightarrow \mathbb{R}^m$$. What is it's derivative? As usual, write the function as the value plus some linear correction:

\\[ f(p+\delta) = f(p) + J \cdot \delta + o(\delta) \\]

As we've noticed before, the correction term $$J\cdot\delta$$ is always a *linear* function of $$\delta$$. The most general way to express a linear function of this form is by a matrix $$J$$ -- the [*Jacobian*](https://en.wikipedia.org/wiki/Jacobian_matrix_and_determinant) of $$f$$, sometimes also written as $$Df$$ or $$\frac{Df}{Dp}$$. It is a matrix of all partial derivatives of components of $$f$$ with respect to components of $$p$$, but that's quite a mouthful to say. What it really says is the following: whenever I make a small step $$\delta$$, the value of a function changes by $$J\cdot \delta$$. That's it. And, as usual, $$J$$ depends on $$p$$ but not on $$\delta$$.

# Complex functions

Complex numbers $$\mathbb C$$ are basically pairs of real numbers $$\mathbb R^2$$ with funny multiplication which somehow turns them into one of the most important mathematical things ever. Say, we have a function $$f:\mathbb C \rightarrow \mathbb C$$. What is it's derivative?

\\[ f(z+\delta) = f(z) + f'(z)\cdot \delta + o(\delta) \\]

Now, here's the catch: for $$f$$ to be complex-differentiable, $$f'(z)$$ is required to be a complex number, and $$\cdot$$ to be complex multiplication. This is different from $$f$$ being differentiable as a function $$\mathbb R^2\rightarrow \mathbb R^2$$, where $$f'(z)$$ was an arbitrary matrix (the *Jacobian*) and $$\cdot$$ was matrix multiplication.

I'll state this again, because this is important to realize: being real-differentiable and being complex-differentiable are two *different* things, with *different* (albeit similar) definitions. The latter implies the former, but not the other way round.

To bring these two definitions closer together, let's first get rid of two types of multiplication here. Multiplication of a complex number $$x+yi$$ by a complex number $$a+bi$$ produces $$(ax-by) + (ay+bx)i$$, and if we view $$\mathbb C$$ as a 2-dimensional real vector space (with basis $$\{1,i\}$$), we can express this operation as a certain matrix acting on a vector $$\begin{pmatrix}x\\ y\end{pmatrix}$$:

\\[ M_{a+bi} = \begin{pmatrix} a & -b \\\\ b & a \end{pmatrix} \\]

If it looks like a rotation matrix to you, that's because it almost is. If we decompose the complex number into the magnitude and phase $$a+bi = r\cdot e^{i\theta}$$, the matrix becomes

\\[ M_{a+bi} = r \cdot \begin{pmatrix} \cos \theta & -\sin\theta \\\\ \sin\theta & \cos\theta \end{pmatrix} \\]

so it's a rotation combined with uniform scaling. That's what complex multiplication always does -- it rotates and scales, but *never* tilts or shears or scales non-uniformly (on one axis and not the other).

So, we can transform the definition involving complex multiplication into using only matrix multiplication:

\\[ f(z+\delta) = f(z) + M_{f'(z)}\cdot \delta + o(\delta) \\]

Here, $$M_{f'(z)}$$ is the matrix of multiplication by the complex number $$f'(z)$$, and $$\cdot$$ is now a usual matrix-vector multiplication. Compared to the definition for a function $$\mathbb R^2\rightarrow \mathbb R^2$$, we see the crucial difference: for a function to be complex-differentiable, it's Jacobian matrix must be of a very special form: it must be $$M_c$$ for some complex number $$c$$ (which, as usual, can depend on $$z$$).

Let's look at a few examples. Take $$f(z) = z^2$$. In components (the real & imaginary parts) it looks like

\\[ f(x,y) = \begin{pmatrix} u(x, y) \\\\ v(x,y) \end{pmatrix} = \begin{pmatrix} x^2-y^2 \\\\ 2xy \end{pmatrix} \\]

The Jacobian (matrix of partial derivatives) then looks like this:

\\[ J = \begin{pmatrix} \frac{\partial u}{\partial  x} & \frac{\partial u}{\partial y} \\\\ \frac{\partial v}{\partial x} & \frac{\partial v}{\partial y} \end{pmatrix}  = \begin{pmatrix} 2x & -2y \\\\ 2y & 2x \end{pmatrix} = M_{2x+2yi} = M_{2z} \\]

So, this matrix is equal to the matrix of multiplication by $$2z$$, meaning the complex derivative of $$z^2$$ is $$2z$$, as it should be!

For another example, take $$f(z) = \bar z$$ (the complex conjugate). In components:

\\[ f(x,y) = \begin{pmatrix} x \\\\ -y \end{pmatrix} \\]

And the Jacobian:

\\[ J = \begin{pmatrix} 1 & 0 \\\\ 0 & -1 \end{pmatrix} \\]

which isn't equal to $$M_c$$ for any choice of a complex number $$c$$. Thus, this function isn't complex-differentiable!

# Complex differentiability

Let's recap. For a function $$f:\mathbb R^2\rightarrow \mathbb R^2$$ to be (real-)differentiable, it must admit an expansion

\\[ f(z+\delta) = f(z) + J \cdot \delta + o(\delta) \\]

for *some* matrix $$J$$ (that depends on $$z$$). For a function $$f:\mathbb C\rightarrow \mathbb C$$ to be complex-differentiable, it must admit an expansion

\\[ f(z+\delta) = f(z) + J \cdot \delta + o(\delta) \\]

where $$J$$ isn't an arbitrary matrix anymore, but $$J=M_c$$ for some complex number $$c$$. So, some complex functions are real-differentiable but aren't complex-differentiable because their Jacobian $$J$$ isn't of this specific form.

This is exactly why complex-differentiable functions are so special. Their Jacobian is a matrix of multiplication by a complex number, meaning it can rotate and scale uniformly, but it cannot tilt or etc. This is exactly why these functions are [*conformal mappings*](https://en.wikipedia.org/wiki/Conformal_map), meaning they preserve angles locally despite doing pretty random stuff globally (becase rotations & uniform scalings preserve angles). This is exactly why complex analysis is so cool. *Well, also because most interesting functions are multi-valued and require thinking about manifolds aka Riemann surfaces.*

By the way, let's try to express the condition $$J=M_c$$ without mentioning $$M_c$$, just as some equations on $$J$$.

\\[ J = \begin{pmatrix} \frac{\partial u}{\partial  x} & \frac{\partial u}{\partial y} \\\\ \frac{\partial v}{\partial x} & \frac{\partial v}{\partial y} \end{pmatrix}  = \begin{pmatrix} a & -b \\\\ b & a \end{pmatrix} \Rightarrow \\]
\\[ \Rightarrow \frac{\partial u}{\partial x} = \frac{\partial v}{\partial y} , \frac{\partial u}{\partial y} = - \frac{\partial v}{\partial x} \\]

These are the [Cauchy-Riemann equations](https://en.wikipedia.org/wiki/Cauchy%E2%80%93Riemann_equations) for a function to be complex-differentiable. They look cryptic at first glance, but all they say is the same idea that the Jacobian is secretly a multiplication by a complex number.

So, we miss some functions which are real-differentiable but not complex-differentiable. How much do we miss, exactly? Well, the space of $$2\times 2$$ real matrices is 4-dimensional, while the space of complex numbers is 2-dimensional, and so is the space of matrices of the form $$M_c$$. We miss half the dimensions!

# Wirtinger derivatives

Now, obviously there's no way we can express the function $$\bar z$$ in the form $$M_c \cdot z$$, but we *can* express it as $$M_c \cdot \bar z$$ by taking $$c=1$$, in which case $$M_c$$ is the identity matrix. So, let's expand our definition of complex derivatives a bit:

\\[ f(z+\delta) = f(z) + M_{c_1} \cdot \delta + M_{c_2} \cdot \bar \delta + o(\delta) \\]

In some sense, we allow two different derivatives: one with respect to $$z$$, another with respect to $$\bar z$$. Complex conjugation can also be expressed as multiplication by a matrix $$I =  \begin{pmatrix} 1 & 0 \\ 0 & -1 \end{pmatrix}$$, so we can rewrite the formula as

\\[ f(z+\delta) = f(z) + (M_{c_1} + M_{c_2}I) \cdot \delta + o(\delta) \\]

Thus, a complex function is differentiable *with this new definition* if it's Jacobian is of a special form $$M_{c_1} + M_{c_2}I$$. How special is it? In fact, not special at all.

Say, $$c_1 = x_1 + y_1 i$$ and $$c_2 = x_2 + y_2i$$. Then, by a direct calculation

\\[ M_{c_1} + M_{c_2}I = \begin{pmatrix} x_1 + x_2 & -y_1+y_2 \\\\ y_1+y_2 & x_1-x_2 \end{pmatrix} \\]

So, if the Jacobian is $$J = \begin{pmatrix} s & t \\ g & h \end{pmatrix}$$, we can set them equal $$J=M_{c_1} + M_{c_2}I$$ and solve for $$c_1$$ and $$c_2$$:

\\[ \begin{matrix} x_1 =  \frac{s+h}{2} & x_2 =  \frac{s-h}{2} \\\\  y_1 =  \frac{g-t}{2} &  y_2 =  \frac{g+t}{2} \end{matrix} \\]

In other words, for *any* $$2\times 2$$ real matrix $$J$$ we can find complex numbers $$c_1, c_2$$ such that $$J=M_{c_1} + M_{c_2}I$$. In other words, if a complex function is differentiable when viewed as a real-valued function, then it is differentiable *with our new definition*.

These two complex numbers $$c_1, c_2$$ are called [*Wirtinger derivatives*](https://en.wikipedia.org/wiki/Wirtinger_derivatives) (*after Wirtinger, who wasn't the first to describe them, in accordance with the Arnold principle, who wasn't the first to...yeah*). They are usually denoted as $$\frac{\partial f}{\partial z}$$ and $$\frac{\partial f}{\partial \bar z}$$, respectively. They are useful in that they expand the usual notion of complex differentiability to include all functions that are smooth in the usual sense. They let us differentiate functions like $$\bar z$$ or $$\|z\|^2=z\bar z$$. As one would expect,

\\[ \begin{matrix} \frac{\partial \bar z}{\partial z} = 0 & \frac{\partial z\bar z}{\partial z} = \bar z \\\\ \frac{\partial \bar z}{\partial \bar z} = 1 & \frac{\partial z\bar z}{\partial \bar z} = z \end{matrix} \\]

They can also be expressed using explicit formulas. If we combine the formulas for $$x_1, y_1$$ above with the structure of the Jacobian, we get

\\[ c_1 = x_1 + y_1 i = \frac{s+h}{2} + \frac{g-t}{2}i = \frac{1}{2}\left(\frac{du}{dx}+\frac{dv}{dy}\right) + \frac{1}{2}\left(\frac{dv}{dx}-\frac{du}{dy}\right)i = \\]
\\[ = \frac{1}{2}\left( \frac{\partial (u+vi)}{\partial x} + \frac{\partial (v-ui)}{\partial y} \right) = \frac{1}{2}\left( \frac{\partial (u+vi)}{\partial x} -i \frac{\partial (u+vi)}{\partial y} \right) \\]
\\[ = \frac{1}{2}\left( \frac{\partial f}{\partial x} - i\frac{\partial f}{\partial y} \right) \\]

Thus,

\\[ \frac{\partial}{\partial z} = \frac{1}{2}\left( \frac{\partial}{\partial x} - i\frac{\partial}{\partial y} \right) \\]

A similar equation for the other derivative can be found using the same method:

\\[ \frac{\partial}{\partial\bar z} = \frac{1}{2}\left( \frac{\partial}{\partial x} + i\frac{\partial}{\partial y} \right) \\]

These expressions hardly explain what's going on, though. What is really going on is the same formula we've been writing during this entire post:

\\[ f(z+\delta) = f(z) + \frac{\partial f}{\partial z}\delta + \frac{\partial f}{\partial \bar z}\bar\delta + o(\delta) \\]

The function has two derivatives: one $$\frac{\partial f}{\partial z}$$ describes the change in the function depending on the offset $$\delta$$, the other $$\frac{\partial f}{\partial \bar z}$$ describes the change in the function depending on the complex conjugate of the offset $$\bar\delta$$.

It works more or less how you'd expect. Here are a few examples:

\\[ \frac{\partial (az+b\bar z)}{\partial z} = a \\]
\\[ \frac{\partial (az+b\bar z)}{\partial \bar z} = b \\]
\\[ \frac{\partial z^2}{\partial z} = 2z \\]
\\[ \frac{\partial z^2}{\partial \bar z} = 0 \\]
\\[ \frac{\partial \bar z^2}{\partial \bar z} = 2\bar z \\]
\\[ \frac{\partial \exp(-|z|^2)}{\partial z} = \exp(-|z|^2)\cdot\bar z \\]

As if $$z$$ and $$\bar z$$ were simply different unrelated variables. Really cool.

# Gradient of real-valued complex function

Let's look at a special case where $$f(z)$$ is a real-valued function of a complex variable. We can think of it as a complex-valued function which happens to only have real outputs, i.e. the imaginary part is zero. Can we compute the usual gradient $$\nabla f = \begin{pmatrix}\frac{\partial f}{\partial x} & \frac{\partial f}{\partial y}\end{pmatrix}$$ using the machinery of Wirtinger derivatives? Yes, we can! Recall that

\\[ \frac{\partial}{\partial z} = \frac{1}{2}\left( \frac{\partial}{\partial x} - i\frac{\partial}{\partial y} \right) \\]
\\[ \frac{\partial}{\partial\bar z} = \frac{1}{2}\left( \frac{\partial}{\partial x} + i\frac{\partial}{\partial y} \right) \\]

Therefore

\\[ \frac{\partial f}{\partial x} = \frac{\partial f}{\partial z} + \frac{\partial f}{\partial \bar z} \\]
\\[ \frac{\partial f}{\partial y} = i\left(\frac{\partial f}{\partial z} - \frac{\partial f}{\partial \bar z} \right) \\]

These are complex-valued expressions, but we're guaranteed that they'll be real-valued if $$f$$ is real-valued.

Now, it is reasonable to treat this gradient not as a 2D vector, but as a complex number again. Let's compute:

\\[ \nabla f = \frac{\partial f}{\partial x} + i\frac{\partial f}{\partial y} = \frac{\partial f}{\partial z} + \frac{\partial f}{\partial \bar z} + i^2\left(\frac{\partial f}{\partial z} - \frac{\partial f}{\partial \bar z} \right) =   \frac{\partial f}{\partial z} +  \frac{\partial f}{\partial \bar z} -  \frac{\partial f}{\partial z} +  \frac{\partial f}{\partial \bar z} = 2  \frac{\partial f}{\partial \bar z}\\]

So, to compute the gradient of a real-valued function of a complex variable and express it as a complex number again, we simply compute twice it's Wirtinger derivative with respect to $$\bar z$$:

\\[ \nabla f = 2 \frac{\partial f}{\partial \bar z} \\]

This is freaking cool, if you ask me.

# Inverse kinematics

In the beginning of the post I mentioned inverse kinematics; let me explain how it is relevant here.

In inverse kinematics, we're trying to move e.g. a robot arm to a specific point, but we can only change the arm angles. This is usually formulated as a minimization problem: minimize the distance between the robot arm and the target point, as a function of arm angles.

Let's look at a very simple 2D case where the arm has just one segment of length 1 and is located at the origin $$(0,0)$$. We model it as a complex number $$z$$ having magnitude 1. Our target point is another complex number $$a$$. We want to minimize $$\|z-a\|^2$$ with the constraint $$\|z\|=1$$. This usually involves computing the gradient of the target function. It is easy to do in this case:

\\[ \nabla \|z-a\|^2 = 2(z-a) \\]

However, it is a bit harder in cases where we have several arm segments and the resulting arm position is computed through several rotations, i.e. complex multiplications. Let's try computing the gradient using the trick from the previous section:

\\[ \nabla \|z-a\|^2 = 2 \frac{\partial}{\partial \bar z} \|z-a\|^2 = 2 \frac{\partial}{\partial \bar z} (z-a)(\bar z - \bar a) = 2(z - a) \\]

It works! Let's try a more involved example: the arm has two segments, both of length 1, the first one $$z_1$$ originates at the origin, and the second one $$z_2$$ originates from the end of the first one and inherits it's rotation. The final position of the arm's end is $$z_1 + z_1z_2 = z_1(1+z_2)$$, and we seek to minimize $$\|z_1(1+z_2)-a\|^2$$. Computing the gradient directly would mean we need to expand this formula in coordinates, but we can instead use the Wirtinger derivative trick again:

\\[ \nabla_{z_1} \|z_1(1+z_2)-a\|^2 = 2 \frac{\partial}{\partial \bar z_1} (z_1(1+z_2)-a)\overline{(z_1(1+z_2)-a)} = 2(z_1(1+z_2)-a)(1+\bar z_2) = \\]
\\[ = 2z_1\|1+z_2\|^2-2a(1+\bar z_2) \\]
\\[ \nabla_{z_2} \|z_1(1+z_2)-a\|^2 = 2 \frac{\partial}{\partial \bar z_2} (z_1(1+z_2)-a)\overline{(z_1(1+z_2)-a)} = 2(z_1(1+z_2)-a)\bar z_1 = \\]
\\[ = 2(1+z_2 - a\bar z_1) \\]

*I'm using the fact that $$\|z_1\|=\|z_2\|=1$$ here.*

Honestly, I'm not exactly sure how useful this is compared to working with real numbers directly, but at least the differentiation step seems to be hugely simplified, and we can translate these formulas back to real number after we've done differentiating.

We can even try to explain these results intuitively: for the gradient with respect to $$z_2$$ we got $$2(1+z_2-a\bar z_1)$$ which means apply the inverse rotation $$\bar z_1$$ to the point $$a$$, which effectively makes the first arm segment lie along the positive X axis, and the arm end is at $$1+z_2$$ and the direction vector from the target point is $$1+z_2-a\bar z_1$$, so the gradient is twice that.

# Quaternions?

Of course, 3D inverse kinematics is much cooler than 2D, but there we'll need quaternions to describe rotations, and I'm afraid we'll need quaternionic derivatives which come with a ton of new problems related to their non-commutativity. Maybe I'll write a follow-up post on quaternions later :)

{% include end_section.html %}