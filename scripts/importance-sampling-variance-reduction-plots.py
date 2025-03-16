#!/usr/bin/env python3

import math
import numpy
import matplotlib.pyplot as pyplot

def f(x):
	return numpy.sin(x)

def sample1(N):
	return numpy.random.uniform(high=math.pi, size=N)

def p1(x):
	return numpy.ones(x.shape) / math.pi

def sample2(N):
	# See https://iquilezles.org/articles/ismoothstep/
	u = numpy.random.uniform(size=N)
	return math.pi * (0.5 - numpy.sin(numpy.asin(1.0 - 2.0 * u) / 3.0))

def p2(x):
	return 3.0 / 2.0 / math.pi * (1.0 - (2.0 * x / math.pi - 1.0) ** 2)

def p_ideal(x):
	return f(x) / 2.0

def monte_carlo_values(x, f, p):
	return f(x) / p(x)

def monte_carlo_integral(values, indices):
	return numpy.cumsum(values) / indices

def single_sample_error(values):
	mean = 2.0
	return math.sqrt(numpy.sum((values - mean)**2) / (values.shape[0] - 1))

def single_sample_running_error(values, indices):
	mean = 2.0
	return numpy.sqrt(numpy.cumsum((values - mean)**2) / indices)

def single_sample_error_estimate(p):
	x = numpy.linspace(0.0, math.pi, 1000)[:-1]
	x = x + math.pi / x.shape[0] / 2.0

	eps = (p(x) - p_ideal(x)) / p_ideal(x)
	return 2.0 * math.sqrt(math.pi * numpy.sum(p_ideal(x) * eps * eps / (1.0 + eps)) / x.shape[0])

N = 1000
indices = numpy.arange(1, N+1)

x1 = sample1(N)
s1 = monte_carlo_values(x1, f, p1)
y1 = monte_carlo_integral(s1, indices)
e1 = single_sample_running_error(s1, indices)

x2 = sample2(N)
s2 = monte_carlo_values(x2, f, p2)
y2 = monte_carlo_integral(s2, indices)
e2 = single_sample_running_error(s2, indices)

# Plot densities
if False:
	x = numpy.linspace(0.0, math.pi, 1000)

	pyplot.plot(x, p_ideal(x), label="p_ideal")
	pyplot.plot(x, p1(x), label="p_uniform")
	pyplot.plot(x, p2(x), label="p_parabola")
	pyplot.legend()
	pyplot.show()

# Plot convergence
if False:
	drop = 100

	pyplot.plot([drop, N], [2, 2], '--', label="true")
	pyplot.plot(indices[drop:], y1[drop:], label="uniform")
	pyplot.plot(indices[drop:], y2[drop:], label="parabola")
	pyplot.legend()
	pyplot.show()

# Plot p1 error estimate
if False:
	est = single_sample_error_estimate(p1)
	pyplot.plot([1,N], [est, est], label="estimate")
	pyplot.plot(indices, e1, label="actual")
	pyplot.legend()
	pyplot.show()

# Plot p2 error estimate
if True:
	est = single_sample_error_estimate(p2)
	pyplot.plot([1,N], [est, est], label="estimate")
	pyplot.plot(indices, e2, label="actual")
	pyplot.legend()
	pyplot.show()

print("Uniform error: {}".format(single_sample_error(s1)))
print("Uniform error estimate: {}".format(single_sample_error_estimate(p1)))
print("Parabola error: {}".format(single_sample_error(s2)))
print("Parabola error estimate: {}".format(single_sample_error_estimate(p2)))