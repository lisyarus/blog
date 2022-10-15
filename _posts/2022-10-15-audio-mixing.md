---
layout: post
title:  "C++ audio mixing library design"
date:   2022-10-15 13:00:00 +0300
categories: programming
---

<script async="" src="//platform.twitter.com/widgets.js" charset="utf-8"></script>

### The problem

I recently took part in [Ludum Dare 51](https://ldjam.com/events/ludum-dare/51) -- a game jam where you have just 48 hours to make a complete game (*or 72 hours, depending on how determined you are*). [Here](https://lisyarus.itch.io/trackdizzia) you can play the game I made: it's a racing game with the track changing every 10 seconds.

<center><img src="{{site.url}}/blog/media/audio/screenshots_all.png" /></center>
<br/>

So, once again I was reminded that sounds are a weak part of both my engine and my skills: I had to add some generated music to the game just to hide the fact that sound effects are unbearably awful. While improving my sound *creation* skills requires a ton of experience and time, improving the engine part should be a bit simpler (*I'm a programmer, after all*).

Currently I'm using the SDL_Mixer library for mixing audio (i.e. adding all input sounds together into the output channel), and I've never been satisfied with it for a number of reasons:
- It requires you to pre-allocate a number of mixing channels, and keep track of their state (whether the channel is playing something or not),
- It allows per-channel effects (in a form of an internal linked lists), but the effects cannot change the number of requested/produced audio samples, so e.g. you cannot implement a simple pitch adjustment effect (which I needed for the racing game to adjust the sound of the car engine),
- It doesn't allow effects applied to the (already mixed) output channel, while I'd really like to stick a compressor there (a thing that doesn't allow the output samples to exceed maximal value, preventing unpleasant clicks and noise),
- It works with samples in `int16` format, while it would be much nicer to work with them as `float`'s.
- It seems to load MP3 files as a whole instead of steam-decoding them, which results in the loading taking a few seconds per track (and I consider a few seconds of startup delay to be unacceptable)

Naturally, instead of looking for alternatives, I decided to implement an audio mixing library myself, mostly because it *sounds* like fun. The whole result is [here](https://bitbucket.org/lisyarus/psemek/src/master/libs/audio), if you want to skip the article and just browse the code.

### The goals

What do I want from my new library? Just a few of things, really:
- A decent C++ interface. All my engine is in C++, and I'm really sick of `SDL_DoThatThing(&options, pointer_to_void, size_in_magical_units, &callback, user_data, legacy_value)` (sorry for all C admirers, I do respect you, it's just that I'm not one of you).
- Simple yet composable & flexible interface. Imagine how all effects and mixers can be simple functions mapping sound streams to sound streams in some nice functional language. Now translate that to C++
- Flexible effects. I want to be able to slap pitch correction to the whole output channel or to a single played sound.
- A compressor. This is mostly about implementing a specific effect, and is not a downside of SDL_Mixer itself. Having clicks & clamps & other noise when adding multiple sound streams together was the worst thing with my previous solution.
- Speed. Audio mixing happens in a separate thread which has to output 44100 audio samples per second (for a standard 44.1 kHz audio), or about 22 μs (microseconds) per sample. It's a pretty low bar for modern machines, but still: all the audio processing with all the effects and mixing should fit into that time span.
- Proper MP3 loading.

### The design

After spending some time thinking & looking at other solutions, I decided to ping the amazing [Alan Wolfe](https://twitter.com/Atrix256), since he's been working a lot in digital audio (and [his blog](https://blog.demofox.org/) is full of good stuff on audio in particular). We had a really fruitful discussion, and he also recommended a [nice book](https://www.amazon.com/Designing-Audio-Effect-Plug-Ins-Processing/dp/0240825152) on digital audio. *The book feels a bit outdated in terms of it's use of C++, also half of the book is boilerplate required for writing plugins for some specific audio system, and occasionally the book features mathematical marvels like <img src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B120%7D%20%5Clarge%20%5Cfrac%7B0%7D%7B0%7D%3D0"/> or <img src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B120%7D%20%5Clarge%20z%5E%7B-1%7D&plus;z%5E%7B-2%7D&plus;%5Cdots&plus;z%5E%7B-%5Cinfty%7D"/>, but the actual audio parts of the book are great. I can now design a simple low-pass or high-pass audio filter in a matter of seconds.* Anyway, one particular tweet struck me more than others:

<center><blockquote class="twitter-tweet" data-lang="en"><a href="https://twitter.com/Atrix256/status/1577505030143643649"></a></blockquote></center>

*A heirarchy of mixing* sounds cool. What if mixing wasn't some final step, like in SDL_Mixer, but rather a compositional primivite? Like, if you want to play a bunch of sounds together, you throw them all into a mixer, which results in another sound, which can be played by itself or thrown into another mixer, you get the idea. I spent a while iterating on the idea, and ended up with a few basic primitives of the library:

- A **stream** is something you can play as a sound. It may be loaded from a file or generated on the fly. It may be finite or infinite. One important thing is that a **stream** is single-shot: it doesn't have a `restart` method or anything like that.
- A **channel** is something where a stream is actually played. You can request the **channel** to stop, or you can replace the **stream** this **channel** is playing.

All other primitives are more or less derivatives of these two:
- A **track** is something that can create identical **streams**. You loaded a sound from disk -- that's a **track**. You start playing it -- that's a **stream**.
- An **effect** is a function that takes a **stream** (or several **streams**) and produces another **stream**, potentially with some handle that allows you to control the **effect** dynamically. Say, you want to control the volume of a **stream**? Nudge it through a `volume` effect and get a volume-controled stream.
- A **mixer** is a thing that turns **streams** into **channels** and produces one output **stream**. Say, the user clicked a button and you want to start playing the corresponding sound: take your output **mixer**, add the button sound **stream** to it, and it returns a **channel** so that you could stop the sound immediataly if you need to.

In terms of some pseudocode, the interface of these primitives looks roughly like this:

```
interface channel {
    void stop();
    void replace(stream new_stream);
}

interface track {
    stream get_stream();
}

stream effect(stream source, float parameter);

interface mixer {
    channel add(stream);
    stream get_output();
}

```

Finally, the whole library provides just a single output **channel**. This, together with all other primitives, covers all my needs:
- If I want to just play a single music file, I load it as a **track**, and put it's **stream** to the library's output **channel**
- If I want to play a few sounds in parallel, I create a **mixer**, put it's output **stream** to the library's output **channel**, and add any sound I want to play as a **stream** to the **mixer**
- If I want some highly flexible & customizable setup like what Alan talks about in his tweet, I can create separate **mixers** for separate classes of audio (UI, environment, effects, dialogues), slap any **effects** on each of them, combine them all in the final **mixer**, put a compressor & volume **effects** on it's output **stream**, and put this into the library's output **channel**.

Gosh I love designing libraries.

### The anatomy of digital sound

Before I talk about the implementation, I'd better say a few things about what it even means to implement and audio effect or mixer. Digital audio works basically by controlling the vibrations of some output audio device, like speakers or headphones. You can imagine them having some rest state, and some maximal deviation from the rest state forward or backward, e.g. the speaker's membrane can shift ±1 mm from it's rest state (*the number is expository, I don't know the real values*). You control it by specifying this shift in normalized units: `0` is rest state, `1` is maximal forward shift, `-1` is maximal backward shift. This value can (and should) change with time. If you send exactly <img src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B120%7D%20%5Clarge%20%5Csin%282%5Cpi%20%5Comega%20t%29"/> as this normalized value, you get a sound of frequency <img src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B120%7D%20%5Clarge%20%5Comega"/>. E.g. for <img src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B120%7D%20%5Clarge%20%5Comega%3D440"/> you'd get something like

<center><audio controls><source src="{{site.url}}/blog/media/audio/440.mp3" type="audio/mpeg"></audio></center>

which is the [A<sub>4</sub> note](https://en.wikipedia.org/wiki/A440_(pitch_standard)). *Don't listen it for too long, you might get dizzy.*

Now, controlling this value directly from code in a continuous fashion would be a synchronization & API nightmare, so instead the audio is specified in discrete samples, typically 44100 samples per second (although other frequencies like 22050 and 48000 are possible). *Why 44100? Humans' hearing range is about 20..20000 Hz, so by [Nyquist theorem](https://en.wikipedia.org/wiki/Nyquist_frequency) we need at least 40000 samples per second, and then manufacturers decided that 44100 is way cooler because [reasons](https://en.wikipedia.org/wiki/44,100_Hz).* If you have two output channels (two headphones, two speakers, etc), you'd need 44100⋅2 = 88200 samples per second. If you have that Dolby Very Cool Sound™ setup with 5 channels, you'd need 44100⋅5 = 220500 samples per second, etc. This samples are typically in a normalized signed 16-bit format (meaning `-32768` gets mapped to `-1` and `32767` gets mapped to `1`), although other formats are possible as well.

My primary (and only) use case is desktop audio, so I'm stuck with 2 channels and a frequency of 44100 Hz. What this means is that the underlying audio system (SDL_Audio in my case) will ask you to provide a total of 88200 numbers every second. However, this would mean that if I want to play some new sound, I'd only be able to start playing it the next time a new chunk of samples is requested, i.e. with a 1-second delay in the worst case. This is clearly unacceptable, so typically the samples will be requested in smaller amounts (so-called *buffer size*) and at a higher rate, and audio libraries usually allow selecting your own value. The other extreme of requesting just 1 sample (or 2 samples for the case of 2 channels) 44100 times a second is also bad: requesting samples has some overhead (preparations, function calls, etc), and we'd like to minimize it by producing as many samples per call as we can.

So, to implement a mixing library means to write a function (the *audio callback*) that produces an array of `int16` values of some specified size every time it is called, and some surrounding code to specify what audio is being played.

### The implementation

First, I decided that the whole library will work with samples as `float` values, and the engine will encode them into `int16` at the very end. I've decided on the sampling frequency of 44100 Hz and a buffer size of 256 samples (times 2 channels), meaning the worst delay for a new sound should be around 5ms, i.e. less than a frame for a screen 60Hz refresh rate.

The **stream** interface is the core of the library, so let's discuss it first. It is remarkably simple:

{% highlight cpp %}
struct stream
{
    virtual std::size_t read(float * data, std::size_t count) = 0;

    virtual ~stream() {}
};
{% endhighlight %}

It's only function is `read` which reads the stream (whatever it means for a particular stream) and outputs no more than `count` samples into the `data` array, and returns the number of samples written. If the return value is less than `count`, the stream has ended and won't ever produce new samples, i.e. `read` will always return 0. For the case of 2 channels, `data[0]` and `data[1]` would be the first samples for the left & right channels respectively, `data[2]` and `data[3]` will be the next corresponding samples, and so on. I'll assume we have just a single channel in the rest of the article, for simplicity.

So, to use a stream, we repeatedly ask it for new samples until it doesn't have any more. This is more or less what the engine's audio callback function does (plus a boring `float -> int16` conversion):

{% highlight cpp %}
struct engine
{
    ...
private:
    std::shared_ptr<stream> stream_;
};

...

void engine::callback(float * output, std::size_t count)
{
    std::size_t samples = 0;
    if (stream_)
    {
        samples = stream_->read(output, count);
        if (samples == 0) stream_ = nullptr;
    }
    std::fill(output + samples, output + count, 0.f);
}
{% endhighlight %}

Notice how we get rid of the stream if it ends, and also fill the output with zeros if we have nothing to play (this depends on a particular audio output library: in case of SDL_Audio, the output array is uninitialized before calling the callback).

Next, a **channel** is pretty simple as well:

{% highlight cpp %}
struct channel
{
    channel(std::shared_ptr<stream> source)
        : stream_(std::move(source))
    {}

    std::shared_ptr<stream> get_stream()
    {
        return stream_;
    }

    void replace(std::shared_ptr<stream> source)
    {
        stream_ = source;
    }

    void stop()
    {
        replace(nullptr);
    }

private:
    std::shared_ptr<stream> stream_;
};
{% endhighlight %}

In real code, all this operations are replaced with [atomics](https://en.cppreference.com/w/cpp/memory/shared_ptr/atomic), since the channel can be accessed both from the main thread & the mixing thread. Modifying the `engine` to use a `channel` instead of a `stream` directly is pretty easy:

{% highlight cpp %}
struct engine
{
    ...
private:
    channel output_;
};

...

void engine::callback(float * output, std::size_t count)
{
    auto stream = output_.get_stream();
    ...
}
{% endhighlight %}

This already allows us to generate some really simple sounds, like the perfect sine waves we've seen above:

{% highlight cpp %}
struct sine_wave : stream
{
    ...

    std::size_t read(float * samples, std::size_t count)
    {
        for (std::size_t i = 0; i < count; ++i)
        {
            samples[i] = std::sin(2 * pi * frequency_ * t_);
            t_ += 1.f / 44100.f;
        }
        return count;
    }

private:
    float frequency_;
    float t_ = 0.f;
};
{% endhighlight %}

However, if you plug just this into the output stream, you'll hear some barely noticeable noise that gets worse over time. What's going on here is floating-point precision: at some point, `t_ + 1.f / 44100.f` necessarily starts rounding, and the sequence of values of `t_` no longer adequately represents the time of each sample. As `t_` grows, the rounding will get worse, and at some point `1.f / 44100.f` will get smaller than the distance between two successive numbers, and `t_ + 1.f / 44100.f` will evaluate to `t_`, effectively stopping any sound.

The solution to this is to implement an *oscillator* -- basically a thing that generates a perfect sine wave of a specified frequency without floating-point problems. There are many ways to make one; I've decided to use the complex numbers: <img src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B120%7D%20%5Clarge%20%5Csin%282%5Cpi%20%5Comega%20t%29"/> is just the imaginary part of <img src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B120%7D%20%5Clarge%20%5Cexp%282%5Cpi%20i%5Comega%20t%29"/>, and in out case <img src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B120%7D%20%5Clarge%20t%20%3D%20n%20t_s"/> with t<sub>s</sub> = 1/44100. So, I can compute the sine wave samples as <img src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B120%7D%20%5Clarge%20f%28k%29%20%3D%20%5Coperatorname%7BIm%7Dz%5Ek"/> where <img src="https://latex.codecogs.com/png.latex?%5Cinline%20%5Cdpi%7B120%7D%20%5Clarge%20z%3D%5Cexp%282%5Cpi%20%5Comega%20i%20t_s%29"/> and Im denotes the imaginary part. This number z can be computed just once, and all I need to do next is repeatedly mupliply the current value by z, which involves arithmetics on numbers in the [-1..1] range, so it mostly keeps the precision issues away. This is what my [oscillator](https://bitbucket.org/lisyarus/psemek/src/master/libs/audio/include/psemek/audio/oscillator.hpp) class does:

{% highlight cpp %}
struct oscillator
{
    oscillator(float f)
    {
        m_ = std::exp(std::complex<float>{0.f, 2.f * pi * f / 44100.f});
    }

    std::complex<float> next()
    {
        phase_ *= m_;
        phase_ /= std::abs(phase_);
        return phase_;
    }

private:
    std::complex<float> phase_{1.f, 0.f};
    std::complex<float> m_;
};
{% endhighlight %}

which we can now use to generate a [sine wave](https://bitbucket.org/lisyarus/psemek/src/master/libs/audio/source/wave/sine.cpp):

{% highlight cpp %}
struct sine_wave : stream
{
    ...

    std::size_t read(float * samples, std::size_t count)
    {
        for (std::size_t i = 0; i < count; ++i)
            samples[i] = o_.next().imag();
        return count;
    }

private:
    oscillator o_;
};
{% endhighlight %}

I also added some basic synthesized [square](https://bitbucket.org/lisyarus/psemek/src/master/libs/audio/source/wave/square.cpp), [triangle](https://bitbucket.org/lisyarus/psemek/src/master/libs/audio/source/wave/triangle.cpp) & [sawtooth](https://bitbucket.org/lisyarus/psemek/src/master/libs/audio/source/wave/sawtooth.cpp) waves.

The interface of a **mixer** is remarkably simple as well:

{% highlight cpp %}
struct mixer
    : stream
{
    virtual std::shared_ptr<channel> add(std::shared_ptr<stream> source) = 0;
};
{% endhighlight %}

The implementation of it is quite boring: it just accumulates the contribution of each channel into the output:

{% highlight cpp %}
std::size_t mixer::read(float * data, std::size_t count)
{
    std::fill(data, data + count, 0.f);
    buffer_.resize(count);

    for (auto & ch : channels_)
    {
        auto read = ch->stream->read(buffer_.data(), sample_count);
        for (std::size_t i = 0; i < read; ++i)
            data[i] += buffer_[i];
    }

    return count;
}
{% endhighlight %}

It also does some housekeeping to maintains a set of channels that are still playing (with atomics, again).

Effects are implemented quite easily as well (depending on the specific effect, though). For example, a volume control effect looks roughly like this:

{% highlight cpp %}
struct volume_control
    : stream
{
    virtual void set_gain(float value) = 0;
};

std::shared_ptr<volume_control> volume(std::shared_ptr<stream> source, float gain = 1.f);
{% endhighlight %}

(`gain` is the audio term for volume), wrapping some existing stream and producing a new stream. *From the API perspective it would be better to return the new stream & the control handle as separate objects. I decided to merge these entities out of pure laziness.* The implementation just requests samples from `source` and multiplies them by the specified `gain`:

{% highlight cpp %}
std::size_t volume_control::read(float * data, std::size_t count)
{
    auto result = stream_->read(data, count);
    for (std::size_t i = 0; i < result; ++i)
        data[i] *= gain_;
    return result;
}
{% endhighlight %}

However, if the user suddenly changes the volume, we'd hear a noticeable click in the output due to a sudden change in the resulting samples, e.g. we were playing some sine wave at volume 1, and got samples like 0.991, 0.992, 0.993, 0.994 etc, and suddenly the volume is 0.5 and the samples are 0.496, 0.497, 0.498. This is one common source of clicks in the audio output. To fix that, we need to gradually change the volume instead of applying the change immediately. Exponential decay is probably the best solution to this:
{% highlight cpp %}
std::size_t volume_control::read(float * data, std::size_t count)
{
    auto result = stream_->read(data, count);
    for (std::size_t i = 0; i < result; ++i)
    {
        data[i] *= gain_;
        gain_ += (new_gain_ - gain_) * smoothness_multiplier;
    }
    return result;
}
{% endhighlight %}

where `smoothness_multiplier` is some number in the range [0..1]. This idea of smoothly changing some parameter to prevent audio defects is used everywhere throught the library.

We could implement a bunch of other effects in a similar fashion, e.g. [fade in](https://bitbucket.org/lisyarus/psemek/src/master/libs/audio/source/effect/fade_in.cpp) gradually increases the volume from 0 to 1 during a specified period, and [fade out](https://bitbucket.org/lisyarus/psemek/src/master/libs/audio/source/effect/fade_out.cpp) does the exact opposite.

One of the most important effects I implemented is the already mentioned compressor: it constantly looks at the source audio stream, and if the samples become louder than a specified threshold, it dampens the sound. I won't go into all the details (the book I mentioned earlier has them!), but the final implementation looks like this:

{% highlight cpp %}
std::size_t compressor::read(float * data, std::size_t count)
{
    auto result = stream_->read(data, sample_count);

    for (std::size_t i = 0; i < result; i += 2)
    {
        float v = std::max(std::abs(data[i]), std::abs(data[i + 1]));
        float multiplier = (v > envelope_) ? envelope_attack_multiplier_ : envelope_release_multiplier_;
        envelope_ += (v - envelope_) * multiplier;
        float strength = strength_;
        float envelope_log = std::log(envelope_);
        if (geom::contains(knee_range_, envelope_log))
            strength *= geom::unlerp(knee_range_, envelope_log);
        float log_gain = strength * std::min(0.f, volume_threshold_log_ - envelope_log);
        float gain = std::exp(log_gain);
        data[i + 0] *= gain;
        data[i + 1] *= gain;
    }

    return result;
}
{% endhighlight %}

There's a bit of math going on, but it seems to work. Alan said that it is a good compressor, and I couldn't dream of a better acknowledgement :)

<center><blockquote class="twitter-tweet" data-lang="en"><a href="https://twitter.com/Atrix256/status/1578427186125496321"></a></blockquote></center>
</br>

Finally, to implement **tracks** I wanted to support loading raw, WAV and MP3 data. Raw samples data is trivial: store it in a buffer, output it in the `read` method. WAV support was almost trivial as well, since SDL_Audio supports loading WAV (although I hard-coded the data format to `int16` and the frequency to 44100; I'll have to write some re-encoding myself in case I need a different WAV file).

To support MP3 files, I decided to use the [minimp3](https://github.com/lieff/minimp3) library. It does exactly what I need: stream-decodes MP3 data and returns floating-point buffers. The only catch is that MP3 may have a different sampling rate (like the one I was testing it with -- it was 48000 Hz), so I had to implement a [resampler](https://bitbucket.org/lisyarus/psemek/src/master/libs/audio/source/resampler.cpp) for that (a thing that converts one sampling frequency to another). Accidentally, the very same code can be used to implement a dynamic [pitch effect](https://bitbucket.org/lisyarus/psemek/src/master/libs/audio/source/effect/pitch.cpp).

In the end, I decided to have some fun & try implementing the Karplus-Strong guitar sound generation algorithm, which I also [learnt from Alan](https://blog.demofox.org/2016/06/16/synthesizing-a-pluked-string-sound-with-the-karplus-strong-algorithm). Here's me using my library in a test application to play a simple melody:

<center><video width="600" controls><source src="{{site.url}}/blog/media/audio/guitar.mp4" type="video/mp4"></video></center>
</br>

The code for this test app is [here](https://bitbucket.org/lisyarus/psemek/src/master/examples/audio.cpp). It's audio setup looks like this:

{% highlight cpp %}
mixer_ = audio::make_mixer();
volume_control_ = audio::volume_stereo(mixer_, 0.5f, 0.5f, 0.1f);
pitch_control_ = audio::pitch(volume_control_, 1.f, 0.025f);
auto compressor = audio::compressor(pitch_control_, audio::from_db(-2.f),
    0.95f, 0.002f, 1.f, audio::from_db(1.f));
pause_control_ = audio::pause(compressor, false, 0.01f);
engine_.output()->stream(pause_control_);
{% endhighlight %}

As you can see, it just creates a bunch of streams that feed one into another. And this is what happens when I press a key on the keyboard:

{% highlight cpp %}
int midi = key_to_midi.at(key);
auto tone = audio::karplus_strong(440.f * std::pow(2.f, (midi - 69) / 12.f));
channels_[key] = mixer_->add(audio::fade_in(tone, 0.002f));
{% endhighlight %}

i.e. a source stream with a fade in effect to prevent an inital click.

### The conclusion

I spent about a week designing & implementing this library and I'm honestly really happy with it. I've learnt a ton about audio, and I have a solid foundation for improving the audio in my future projects. I have no idea how convenient & performant it will turn out, but my experiments with the test application were quite encouraging.

Feel free to inspect the code (it's quite readable, for the most part, I think) and/or even use the library. It's a bit integrated into my engine, but you could probably strip the dependencies easily. I'd encourage you to implement you own such library, though, -- it's *so much fun*! And thanks for reading.
