---
layout: post
title:  "Porting my C++ game engine to Android"
date:   2023-07-19 18:00:00 +0300
categories: programming
steamwidgets: yes
---

The annual [GMTK Jam](https://itch.io/jam/gmtk-2023) has just finished, breaking [itch.io](https://itch.io) servers again, as per tradition. I was pretty happy with how I approached the jam this time (rapid fail-early prototyping, reasonable scheduling, nice art style, that sort of thing), although my game [wasn't received](https://itch.io/jam/gmtk-2023/rate/2161694) as warmly as I've hoped. [Here it is](https://lisyarus.itch.io/tower-offense), by the way; it is a kind of reverse tower defence thing.

<center><img width="100%" src="{{site.url}}/blog/media/android/tower-offense.png"></center>
<center><i>A completely reasonable situation.</i></center>
<br>

If you go to the game's page, you might notice a weird thing: it has an Android version! I've been thinking of building for Android for quite some time, and this game felt like a great candidate due to being quite minimalistic in design.

It only runs on certain architectures (arm64-v8a) and Android API versions (26+), but still. It doesn't sound like a big deal until you realize that I'm using my own C++ game engine. It took me about a week to support building for Android, and in this post I'm going to tell you how this is done.

*If you're only interested in how to build Android apps without Gradle, Maven, or Android Studio, jump straight to the [stage 2](#stage-2-building-an-android-app).*

**Contents:**
* TOC
{:toc}

## Stage 0: Reevaluating my life choices

### Why?

Why am I even doing this? Here are a few legitemately good reasons I came up with:

* This is a valuable, albeit quite painful, **experience** for me as an engineer
* If I ever want to actually **make mobile games**, I will be able to use my beloved engine
* Is it a good step towards supporting **more platforms**, like web (using WASM and Emscripten)

But honestly the most important reason is **just for fun**. The feeling of running your project on a device that it couldn't run on before is extremely satisfying.

### How?

Now that we believe this whole endeavour is worth a try, how are we gonna do it? I'm using [SDL2](https://www.libsdl.org) (a platform abstraction library, used for e.g. window & OpenGL context management, and audio output) for desktop builds, and I've heard you can use SDL2 to build for android directly, so I decided to look into how they do it.

Long story short, I didn't like it at all.

They rely on you using `SDL_main` (a function you need to define in order to work with SDL because they define `main` themselves but this `main` is in a library different from `libSDL` namely `libSDL_main` and they *conveniently* do `#define main SDL_main` so that it looks like you're just writing `main` but then you get linker errors about `main` not being there...), which I've successfully avoided doing all these years. They pretend that you still own the application loop (which you don't -- Android owns it!) and create a separate thread with a compex inter-thread communication system to make it work. They don't have any documentation on how to use their thing, only a tiny single-file example.

So, if I'm not using SDL2, what do I use instead? At this point, a scary idea visited my deranged mind: I can actually do all this *myself*. I mean, I don't need all the stuff that SDL2 supports, and I already know a lot about using native (i.e. C++) OpenGL rendering inside an Android app (after all, that's what I do at work), so...how hard it can be? *Oh, sweet summer child.*

My general idea went like this:
* Build my engine & game into a shared library that exposes some setup routines, event handlers and a render callback through [JNI](https://en.wikipedia.org/wiki/Java_Native_Interface)
* Make an Android app that creates an OpenGL-renderable surface, loads said library and calls the appropriate functions

Before I could do that, I needed some refactoring to be done.

## Stage 1: Preparations

### Application abstraction

My engine's core application code looked like this: we have a
* Base application class, which uses SDL2 to create a window, OpenGL context, setups logging, and manages a handful of unrelated stuff, and a
* Project's application class which inherits the base application and does some project-specific things, including initialization of resources, event handling and rendering to the screen.

Then I had a helper function which is meant to be the `main` of your executable, which basically just sets up some more initialization and calls the `application.run()` method. A typical project using my engine would look like this (class names are changed to be more readable):

{% highlight cpp %}
class my_application
    : public psemek::base_application
{
public:
    my_application()
        : base_application("My Application!")
    {}

    void draw() override
    {
        drawSomethingCool();
    }
};

int main()
{
    return psemek::main<my_application>();
}
{% endhighlight %}

There are three major problems with this approach:
* It depends on SDL2 at it's core
* It owns the application loop through the `application.run` method
* Inside it is a horrible monstrosity born from several years of neglected technical debt

So, instead I made an `application` into an [interface](https://bitbucket.org/lisyarus/psemek/src/master/libs/app/include/psemek/app/application.hpp): it can [handle events](https://bitbucket.org/lisyarus/psemek/src/master/libs/app/include/psemek/app/event_handler.hpp), draw something on the screen, and tell if it's stopped. Each project supplies its own implementation of this interface, which is then used by the engine.

There's a catch, though: I want to supply the engine with certain data *before* the application is even constructed. For now it's just the window title and a multisampling factor, but I might add more stuff in the future; let's call these *application options*. I want to pass them to the engine, make it initialize all the stuff (like a window and OpenGL context), and then create an application.

I could use late initialization here (i.e. an `application.init` method), but I simply hate late initialization. C++ has constructors, use them to initialize objects, period. The concept that each object is valid and ready to use immediately after being created is incredibly useful and saves you from millions of useless `if (!valid())` checks.

So, I introduced the concept of an *application factory*: also an interface which the engine can use to query *application options*, do the initialization, and then use the factory again to actually create the application. Something like this:

{% highlight cpp %}
class application
{
public:
    virtual void draw() = 0;
    virtual void on_event(...) = 0;
};

struct options
{
    std::string title;
    int multisampling;
};

class factory
{
public:
    virtual options get_options() = 0;
    virtual std::unique_ptr<application> create_application() = 0;
};
{% endhighlight %}

Now, there might be some data that the engine itself might want to return back to the application, like some callbacks to hide the mouse cursor or disable vsync. I've called it an *application context*, because I was running out of words. This is passed to the application factory, along with the *options* for convenience:

{% highlight cpp %}
struct context
{
    // some callbacks
};

class factory
{
public:
    virtual options get_options() = 0;
    virtual std::unique_ptr<application>
        create_application(options const &, context const &) = 0;
};
{% endhighlight %}

Now, the project simply defines a function that creates the application factory (i.e. a factory factory, yeah):

{% highlight cpp %}
std::unique_ptr<factory> make_application_factory();
{% endhighlight %}

which is in turn used by the engine.

### Backend library

Now the application doesn't know anything about SDL2, but *something* should know about it! This is where I introduced the concept of a *backend library*.

I usually don't like calling my engine an *engine*, because I picture engines as those monolithic centralized things, while my engine is more like a set of loosely-coupled [standalone libraries](https://bitbucket.org/lisyarus/psemek/src/master/libs). You can easily create a console executable that does some math, or generates sound, or [renders vector graphics on the CPU](https://bitbucket.org/lisyarus/psemek/src/master/libs/vecr), whatever. You never need to initialize or even deal with stuff you don't use.

Now there is a new library in the engine which is a bit special: it's called `sdl2`, and it is a *backend library*, meaning it isn't included in the engine by default, but linked with your application only if you explicitly say that you want an application (as opposed to regular executable) by using a special CMake function provided by the engine.

This *backend library* is the thing that calls your `make_application_factory()` and actually uses it, in any way it sees fit. In the case of SDL2, this is pretty straightforward:

{% highlight cpp %}
// Somewhere in the sdl2 library
int main()
{
    auto factory = make_application_factory();
    auto options = factory->options();
    create_window_and_gl_context(options);
    context ctx{...}; // this is app context, not OpenGL context
    auto application = factory->create_application(options, ctx);

    while (!application->stopped())
    {
        poll_events(application);
        application->draw();
        swap_buffers();
    }
}
{% endhighlight %}

So, the main application loop is moved from the application itself to an external library, which allows for much more flexibility in how the application class is used, as we'll see later.

The backend library is also responsible for the *audio backend* and *loading resources*; we'll talk about that later as well.

## Stage 2: Building an Android app

### Bare-bones

The end result of the process should be an Android application, i.e. an [APK file](https://en.wikipedia.org/wiki/Apk_(file_format)) which I can download, install, confirm that I trust the unrecognized developer, and run it.

<center><img width="100%" src="{{site.url}}/blog/media/android/obi-wan.png"></center>
<center><i>The unrecognized developer.</i></center>
<br>

So, my first thought was to try and just build an empty Android app, without any OpenGL or JNI or whatever. In my C++ world with pink ponies and rainbow unicorns, the first thing you do when learning C++ is how to invoke the compiler (well, unless you're using Windows, that is). You learn that you can literally open a console, write `g++ my.cpp -o my` and there you are, you have a working C++ application. How much simpler can it be? Then you learn about build systems and stuff like that, but occasionally you have to go inspect what's happening on the compiler level, because build systems never work the way you want them to.

So I naively assumed that the same is true of making Android apps. There are things like Gradle and Maven, but surely I should be able to just run a couple of commands in the console and have a working `.apk`? You'd probably need more than just a single source file, but still.

Well, this turned out to be possible, but much harder than I expected. The problem is that no sane person does it this way. I've only found [a single article](https://authmane512.medium.com/how-to-build-an-apk-from-command-line-without-ide-7260e1e22676) about this, which is hopelessly outdated because Google likes changing their APIs twice a week. Nevertheless, with a lot of extensive googling I managed to figure out how to to that.

### SDK

The first thing we need is an Android SDK. Most resources about it just tell you which Android Studio menu to open in order to select your SDK version. Apparently things like Gradle also download them on the fly from god-knows-where. However, if you go to [developer.android.com/studio](https://developer.android.com/studio) and scroll far enough down, you'll find a *Command line tools only* section -- this is exactly what we need.

Then, follow [these steps](https://developer.android.com/tools/sdkmanager) to unpack the downloaded package. They advise doing some strange folder manipulations -- **do them**, otherwise the thing just won't work.

Assuming you did the above, you'll have a `<somewhere>/cmdline-tools/latest/bin/sdkmanager` executable, which can list available packages via `sdkmanager --list` and install them. We need the `build-tools` and the `platforms` packages. `build-tools` is a set of command-line tools that assemble the Android app; `platforms` is a Java package with Android runtime bindings, something like that.

In my case, I installed `build-tools;34.0.0` and `platforms;android-34`. **34** is the [Android API version](https://apilevels.com) we'll be targeting. *Don't worry, we will be able to run on older API versions as well.* It asks you to accept some licenses and defaults to **not** accepting them, so be careful not to accidentally skip this. You'd also want to pipe `yes` into this thing if this is happening inside some script.

We now have our SDK with a few directories that we'll use a lot. Let's define a few shortcuts (replace `<somewhere>` with your installation path):

```
BUILD_TOOLS=<somewhere>/build-tools/34.0.0
PLATFORM=<somewhere>/platforms/android-34
```

*You can also use `sdkmanager` to install the Android NDK, though I used a different method for reasons I'll explain later.*

Oh, and you'll need a Java compiler, so install OpenJDK or something like that if you don't have it already. *I forgot about it the first time I was building my Docker container for android packaging!*

### Assembling

Now, create a bare-bones Android project. We only need two files: `AndroidManifest.xml` in the project root containing some app metadata, and `MainActivity.java` somewhere in `src/your/application/name` (or whatever you'll call it) with the main activity class. Here's the java file:

{% highlight java %}
package your.application.name;

import android.app.Activity;

public class MainActivity extends Activity {
    // do nothing, successfully
}
{% endhighlight %}

and the xml file:

{% highlight xml %}
<?xml version='1.0'?>
<manifest xmlns:a='http://schemas.android.com/apk/res/android' 
    package='your.application.name'
    a:versionCode='0'
    a:versionName='0'>
    <uses-sdk
        a:minSdkVersion="26"
        a:targetSdkVersion="34"/>
    <application
        a:label='My Application'>
        <activity
            a:name='your.application.name.MainActivity'
            a:exported="true">
            <intent-filter>
                <category a:name='android.intent.category.LAUNCHER'/>
                <action a:name='android.intent.action.MAIN'/>
            </intent-filter>
        </activity>
    </application>
</manifest>
{% endhighlight %}

*`a:` seems to be a shorthand for `android:`, though the latter doesn't work for me despite being present in thousands of tutorials and stackoverflow answers. The `exported` attribute seems to be important for the main activity. Don't cite me on that, I'm as good a mobile developer as I'm an astronaut.*

Now, we'll need to *sign* the resulting APK, so we need to generate a key first. This is how it is done:

`keytool -genkeypair -validity 365 -keystore mykey.keystore -keyalg RSA -keysize 2048`

The `keytool` executable should come with the JDK installation. The `mykey.keystore` file now contains our key in an encrypted form.

Given these files, we can already build an android application! We just need a bunch of magic commands:

* Create a few directories that will be useful later:

`mkdir bin`
* Do something related to packaging resources and metadata:

`${BUILD_TOOLS}/aapt package -f -m -J ./src -M ./AndroidManifest.xml -I ${PLATFORM}/android.jar`

(you can add `-S ./res` if you have some resource files)
* Compile the Java code:

`javac -d obj -classpath src -classpath ${PLATFORM}/android.jar src/your/application/name/*.java`
* Convert Java bytecode into Android bytecode or smth like that:

`${BUILD_TOOLS}/d8 --output . obj/your/application/name/*.class`
* Make an actual APK file:

`${BUILD_TOOLS}/aapt package -f -m -F ./bin/myapp.unaligned.apk -M ./AndroidManifest.xml -I ${PLATFORM}/android.jar`
* Add the compiled code to the APK:

`${BUILD_TOOLS}/aapt add bin/myapp.unaligned.apk classes.dex`
* Align the APK, whatever this means:

`${BUILD_TOOLS}/zipalign -f 4 ./bin/myapp.unaligned.apk ./bin/myapp.apk`

* Finally, sign the APK:

`${BUILD_TOOLS}/apksigner sign --ks mykey.keystore ./bin/myapp.apk`

You will be asked a password; if you don't want to type it every time, add `--ks-pass pass:YOUR-PASSWORD-HERE` to the last command.

Horray! Send `bin/myapp.apk` to your phone somehow (via `adb install` or just send it to yourself via a messenger) and it should be an empty application which successfully runs and does nothing.

### Gradle

The process above works, but it feels a bit...shaky? Diving in all those low-level details that could change at any moment. So I thought to give actual build systems a try.

Gradle is probably the most widespread build system for Android. Is it even a build system? I don't know and I don't care, so I'll keep calling it that. Anyway, I installed it and executed a command that supposedly should setup an empty project. Gradle proceeded to download hundreds (literally) of heavy packages, and I wasn't patient enough to wait for it to finish.

This huge downloading is a problem for me. You see, I want to wrap all this building process into a clean, isolated, reproducible environment (a Docker container), and if Gradle starts downloading petabytes of data on every build, that's gonna be a problem -- these things won't cache inside the container, since it's being thrown away after the build finishes.

I'm told there are ways to pre-download this cache, but this doesn't sound like a reliable solution for me. Gradle seems to go to the internet to check for updates and download and upgrade god-knows-what on every run. How bad will it be after a week? A month? A year? Will it even work without an internet connection (all my other build scripts work flawlessly without it)? These are the questions I was too scared to learn the answer to.

There's also the problem of *iteration time*. This is the single most important thing in any development process, especially so when you have hard time constraints like on game jams. At the same time, Gradle is well-known for being notoriously slow. The above low-level process executes in under 2 seconds on my machine, -- a time span Gradle needs to just realize that it was executed at all.

So, no Gradle for me.

### Maven

Someone also suggested using Maven, as it is supposedly more sane that Gradle. So, I installed it and executed a command to set up an empty project. It too began downloading a lot of stuff, but it finished much faster than Gradle! It crashed trying to download something it needs that doesn't exist anymore. Cool.

So, I stuck with the bare-bones approach to compiling an Android app.

### GLSurfaceView

Before going further, let's make our Android app actually draw something on the screen using OpenGL, like clear the screen with some color.

Android has a special class for that called [`GLSurfaceView`](https://developer.android.com/reference/android/opengl/GLSurfaceView). The docs already have an example of how to use it, but let me show it here as well:

{% highlight java %}
package your.application.name;

import android.app.Activity;
import android.opengl.GLSurfaceView;
import android.opengl.GLSurfaceView.Renderer;
import javax.microedition.khronos.opengles.GL10;

public class MainActivity extends Activity {
    class RendererImpl implements Renderer {
        @Override
        public void onSurfaceCreated(GL10 gl10, EGLConfig config) {
        }

        @Override
        public void onSurfaceChanged(GL10 gl10, int width, int height) {
            gl10.glViewport(0, 0, width, height);
        }
        
        @Override
        public void onDrawFrame(GL10 gl10) {
            gl10.glClearColor(0.8, 0.8, 1.0, 1.0);
            gl10.glClear(gl10.GL_COLOR_BUFFER_BIT);
        }
    }

    class ViewImpl extends GLSurfaceView {
        private final RendererImpl renderer;

        public ViewImpl(Context context) {
            super(context);
            // Choose the OpenGL ES version
            setEGLContextClientVersion(3);
            // Choose the screen format
            setEGLConfigChooser(8, 8, 8, 8, 24, 8);

            renderer = new RendererImpl();
            setRenderer(renderer);

            // Render all the time, without explicitly
            // asking for updates
            setRenderMode(GLSurfaceView.RENDERMODE_CONTINUOUSLY);
        }
    }

    private ViewImpl view;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        view = new ViewImpl(this);
        setContentView(view);
    }
}
{% endhighlight %}

This should clear the app screen to a nice light-blue color. To enable OpenGL ES 3.2 in our application, we need to patch `AndroidManifest.xml`:

{% highlight xml %}
<?xml version='1.0'?>
<manifest xmlns:a='http://schemas.android.com/apk/res/android' 
    package='your.application.name'
    a:versionCode='0'
    a:versionName='0'>
    <uses-sdk
        a:minSdkVersion="26"
        a:targetSdkVersion="34"/>
    <uses-feature
        a:glEsVersion="0x00030002"
        a:required="true"/>
    <application
        a:label='My Application'>
        <activity
            a:name='your.application.name.MainActivity'
            a:exported="true"
            a:screenOrientation="landscape">
            <intent-filter>
                <category a:name='android.intent.category.LAUNCHER'/>
                <action a:name='android.intent.action.MAIN'/>
            </intent-filter>
        </activity>
    </application>
</manifest>
{% endhighlight %}

I've also added the `screenOrientation="landscape"` option, so that X and Y coordinates are swapped and we don't have to work with a vertical screen.

There is one more thing I wanted here: removing the system toolbars, since they're not usually used in games. I achieved this by adding these lines in `MainActivity.onCreate`:

{% highlight java %}
    ActionBar actionBar = getActionBar();
    if (actionBar != null) {
        actionBar.hide();
    }

    WindowInsetsController windowInsetsController = view.getWindowInsetsController();
    if (windowInsetsController != null) {
        windowInsetsController.hide(Type.systemBars());
        windowInsetsController.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
{% endhighlight %}

*(You'll need a few more imports for this.)*

Now comes the fun part.

## Stage 3: Cross-compiling

### NDK

Cross-compiling means compiling code on one system (the *host*) that is going to run on a different system (the *target*). In C++, this means you nead a specially configured compiler capable of producing binaries for the *target* CPU architecture, you need various system libraries like the C and C++ standard library for the *target* platform, and you need some build system massaging to convince it to use the proper compilers and libraries. Thankfully, in the case of cross-compiling for Android, we have a standard solution: the [NDK](https://developer.android.com/ndk) (Native Developement Kit).

We can install NDK using `sdkmanager` that we used before, like e.g. the latest LTS version `ndk;25.2.9519653`. However, it comes with a pretty old compiler (namely, clang 14), which lacks some C++20 features, like template deduction guides for `std::weak_ptr` and comparison operators for `std::strong_ordering`, to name a few. I was thinking for a while about how I could overcome this issue, like maybe patching the supplied C++ standard library, but it turned out there's a better solution.

NDK-r25 is the latest LTS (long-term support) version, but there's a newer one, namely NDK-r26-beta1. You can't install it through `sdkmanager`, but you can [download it manually](https://developer.android.com/ndk/downloads). This is the one I used: it comes with clang 17, which is much better in terms of C++20 support.

If you install the r25, it will go to a folder `ndk` next to your `cmdline-tools` folder; the full path to the NDK would be `<somewhere>/ndk/25.2.9519653`.

If you download the r26-beta1, it will be just a zip archive, which I unpacked and renamed the root folder from whatever it was to `26.0.10404224-beta1` (you can look up this version in the `source.properties` file in the extracted folder). Then, I moved it to the same `ndk` directory, with the path to the new NDK being `<somewhere>/ndk/26.0.10404224-beta1`.

In any case, let's define `NDK=<somewhere>/ndk/<your-ndk-version>` in what follows.

### CMake

Whatever build system you use, you need to configure a lot of stuff to make it use this NDK. If you're using CMake, things get a bit easier. CMake uses special [toolchain files](https://cmake.org/cmake/help/latest/variable/CMAKE_TOOLCHAIN_FILE.html) to define a bunch of variables about your build environment that are otherwise impossible to set via a normal `CMakeLists.txt` file. These toolchain files are especially useful for cross-compiling.

The Android NDK supplies it's own toolchain file for CMake. It is located at `${NDK}/build/cmake/android.toolchain.cmake`. A CMake invocation that uses this toolchain file might look like this:

```
cmake -S source-dir -B build-dir \
    -DCMAKE_TOOLCHAIN_FILE="${NDK}/build/cmake/android.toolchain.cmake"
```

However, in case of Android NDK, we need to supply a bunch of other options for CMake:
* `-DANDROID_PLATFORM=34` -- the API version we are targetting
* `-DANDROID_STL=c++_shared` -- whether to use a static or shared version of the C++ standard library
* `-DANDROID_CPP_FEATURES="rtti exceptions"` -- what optional C++ features we are going to use (these are off by default)
* `-DANDROID_ABI=arm64-v8a` -- the target CPU ABI.

So, the full configure command would be something like this:
```
cmake -S source-dir -B build-dir \
    -DCMAKE_TOOLCHAIN_FILE="${NDK}/build/cmake/android.toolchain.cmake" \
    -DANDROID_USE_LEGACY_TOOLCHAIN_FILE=ON -DANDROID_PLATFORM=34 \
    -DANDROID_STL=c++_shared -DANDROID_CPP_FEATURES="rtti exceptions" \
    -DANDROID_ABI=arm64-v8a
```

If you open the `android.toolchain.cmake` file, you'll notice that it immediately fallbacks to some `android-legacy.toolchain.cmake`, unless this behavior was explicitly disabled. My first thought was that I don't want some legacy stuff, I want the new, *good stuff*, so I went ahead and added `-DANDROID_USE_LEGACY_TOOLCHAIN_FILE=OFF` to CMake invocation. Then I spent a good part of my evening trying to figure out how it is possible that the C++ compiler fails to find it's own standard library headers. Long story short: don't do that, don't disable the legacy toolchain, it is the one that actually works.

### libPNG

If you're using any third-party libraries that aren't header-only, you'll need to cross-compile them, too. I'm using libPNG for reading PNG images, so I started here. This one we can take directly from [github](https://github.com/glennrp/libpng), and it compiles easily with CMake. The whole process is as follows:

```
# Create a special directory for libPNG
mkdir png && cd png

# Shallow-clone the latest release branch to 'source' directory
git clone https://github.com/glennrp/libpng.git -b libpng16 --depth 1 source

# Configure the build
mkdir build
cmake -S source -B build -DCMAKE_INSTALL_PREFIX=install/arm64-v8a \
    -DCMAKE_TOOLCHAIN_FILE="${NDK}/build/cmake/android.toolchain.cmake" \
    -DANDROID_PLATFORM=34 -DANDROID_STL=c++_shared -DCMAKE_BUILD_TYPE=Release \
    -DANDROID_CPP_FEATURES="rtti exceptions" -DANDROID_ABI=arm64-v8a

# Build and install the binaries
cmake --build build -t install -j
```

Now, `png/install/arm64-v8a/lib` contains `libpng.so` built for our Android system. Yay.

libPNG in turn needs the `libz` compression library, but this one is bundled with the NDK and is already present on any Android device, so we don't need to worry about it.

### Boost

I'm also using [Boost](https://www.boost.org) in my engine. Many people think that Boost is the worst library ever designed, but I'm completely fine with it. Most parts of Boost that I use are header-only, meaning they don't require a separate compilation step. However, I'm also using Boost.Random, -- which isn't header-only, -- for a single purpose: it provides a platform-specific source of random numbers, good for initializing your RNG for map generation, enemy AI, etc. So I needed to build specifically Boost.Random with Android NDK.

Boost doesn't use CMake. In fact, Boost uses it's own special build system called Boost.Build, which is a bit tricky to configure. Here's how it goes.

First, we download the version of Boost we need, like the [latest 1.82.0](https://boostorg.jfrog.io/artifactory/main/release/1.82.0/source/) version. Note that we need the *source code*, not just a development package some systems provide (like `libboost-all-dev` on Ubuntu). Unpack it somewhere, it will become a folder `boost_1_82_0`. I renamed and moved it to `<somewhere>/boost/source`, for consistency with libPNG.

Then, we need to *bootstrap* the compilation by doing this in the `source` directory:
```
./bootstrap.sh --with-libraries=random --prefix=../install/arm64-v8a
```

I'm specifying an architecture-specific installation directory, just like for libPNG, and I'm also telling that I only need the Random library.

Now we need to supply an equivalent of a CMake toolchain file for Boost. This is done using a special config file. We'll call it `user-config.jam`, put it somewhere, like in the `<somewhere>/boost` directory, and write this in it:
```
using clang : android : ${NDK}/toolchains/llvm/prebuilt/linux-x86_64/bin/clang++ --target=aarch64-none-linux-android34 --sysroot=${NDK}/toolchains/llvm/prebuilt/linux-x86_64/sysroot ;
```

*Of course, ${NDK} should be the NDK location we defined earlier.*

The `using clang : android` defines a *toolset* called `clang-android`, and it tells Boost that it is a variant of a Clang compiler, so that it configures properly. The next long line is the command to invoke the compiler; I reverse-engineered it from the CMake toolchain files NDK provides.

Now we can build boost, doing this from the `source` directory again:
```
./b2 toolset=clang-android target-os=android architecture=arm variant=release \
    link=shared threading=single --user-config=../user-config.jam \
    --build-dir=../build install
```

We set a bunch of options here; the most important is `--user-config=../user-config.jam` pointing to the config file we created before, and the `toolset=clang-android` telling it to use the compiler from the config file. It is important to call it `clang-something` (i.e. write `using clang : something : ...` in the `user-config.jam`) and not just `clang` (i.e. `using clang : : ...`), because otherwise it might interfere with your system-installed clang and not use the NDK compiler. `clang-android` worked great for me.

Now we should have our boost binaries in `<somewhere>/boost/install/arm64-v8a/lib`, and the Boost include files in `<somewhere>/boost/install/arm64-v8a/include`.

### Architectures

For now, we were building everything only for the `arm64-v8a` ABI. However, there are others, namely `armeabi-v7a`, `x86` and `x86_64`. An Android APK contains Java bytecode and native binaries; Java bytecode is ABI-independent, but the native code must be built for every architecture separately. We'll see later that the same APK can contain native binaries for different ABI's.

I've only built things for `arm64-v8a` because this is by far the most common ABI (and the one my phone has), but it is possible to extend the process to build for other architectures as well. That's why I'm putting everything in ABI-dependent folders like `install/arm64-v8a`.

### The Game: host

It is occasionally useful to have some tools in your project that are used during the build process. Maybe you have some file converters, or content generators, or asset preprocessors, that sort of thing. Their source is included in the project, and we need to build them to be able to use them, but we don't need to build them for the *target* system: they will be invoked *during* the build, so they are run on the *host* system.

I use custom CMake variables `PSEMEK_PACKAGE_HOST` and `PSEMEK_PACKAGE_TARGET` to differentiate between *host* and *target* builds. First, I set `PSEMEK_PACKAGE_HOST=ON` and invoke the build using whatever compiler the *host* system has, completely ignoring the Android NDK. The tools so built are installed in a special `tools` directory. Then, I set `PSEMEK_PACKAGE_TARGET=ON` and build the game itself. The CMake scripts for the project know what needs to be built during which phase.

```
mkdir build-host tools
cmake -S source -B build-host -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_INSTALL_PREFIX=tools -DPSEMEK_PACKAGE_HOST=ON
cmake --build build-host -t install -j
```

Here, `source` is the directory with the actual game's source code. The tools get installed to the `tools` directory, which I'll refer to as `${TOOLS}` from now on.

Notice that these tools don't need to be built for each *target* ABI, since they are invoked on the *host* system.

I use the same trick when cross-compiling my projects to Windows using the MinGW compiler. I don't use it when packaging for Linux, since in this case the *host* and *target* systems coincide, so I build everything once with both `PSEMEK_PACKAGE_HOST=ON` and `PSEMEK_PACKAGE_TARGET=ON`.

### The Game: target

Now I need to cross-compile my game engine and the game source for the *target* system, i.e. Android. There's nothing particularly special about it compared to what we've seen before. One extra thing we need is to tell where to find our libPNG and Boost libraries, and also the *host* tools. The Android NDK toolchain file effectively sets the system root to some folder inside the NDK so that nothing from the *host* system is accidentally used there. I used `CMAKE_FIND_ROOT_PATH` to overcome this:

```
mkdir -p build-target/arm64-v8a
cmake -S source -B build-target/arm64-v8a/build \
    -DCMAKE_BUILD_TYPE=Release -DANDROID_PLATFORM=34 -DANDROID_STL=c++_shared \
    -DANDROID_CPP_FEATURES="rtti exceptions" -DANDROID_ABI=arm64-v8a \
    -DCMAKE_TOOLCHAIN_FILE="${NDK}/build/cmake/android.toolchain.cmake" \
    -DCMAKE_FIND_ROOT_PATH="${BOOST_ROOT}/arm64-v8a;${PNG_ROOT}/arm64-v8a;${TOOLS}" \
    -DCMAKE_INSTALL_PREFIX="build-target/arm64-v8a/install" \
    -DPSEMEK_PACKAGE_TARGET=ON
cmake --build build-target/arm64-v8a/build -t install -j
```

Here, `BOOST_ROOT` is `<somewhere>/boost/install/arm64-v8a` and `PNG_ROOT` is `<somewhere>/png/install/arm64-v8a`.

Now `build-target/arm64-v8a/install` should contain my project built for Android. Except it will fail at link stage, since I'm making an executable from it, and it doesn't use the SDL2 backend library, so it lacks a `main` function. What we need is to turn it into a shared library.

### The Game: shared library

In CMake, making shared libraries is as simple as `add_library(library_name SHARED ...)`. I've added some CMake code that either compiles the project as an executable or a shared library, depending on the backend used (SDL2 or Android).

One thing to note here is that the interplay between static and shared libraries is a quirky one, and I myself don't understand many parts of it. As I've said earlier, my engine is really a bunch of libraries that are typically build as static libraries. The downside was that the JNI symbols (which we'll talk about in a minute) defined in the android-backend library weren't exported in the final project's shared library. I fixed that by adding special linker options when linking the backend library:

```
target_link_libraries(${target} PUBLIC
    "-Wl,--whole-archive $<TARGET_FILE:${PSEMEK_BACKEND_LIBRARY}> -Wl,--no-whole-archive"
    ${PSEMEK_BACKEND_LIBRARY})
```

Another solution would be to build all the engine libraries as shared libraries, but that would mean a whole lot of shared libraries to load at app startup (which isn't a fast process) and a lot of missed optimization opportunities in between these libraries.

Yet another option would be to build them as *object libraries* using `add_library(library_name OBJECT ...)` which are treated more like a bunch of compiled code than a separate library. I didn't try this, though.

Now we have a shared library with our game, but the Java code doesn't know about it yet.

## Stage 4: JNI

### Defining methods

JNI (Java Native Interface) is the thing that allows one to use native code (e.g. written in C or C++) to be called from Java code. It works like this:

* You declare a certain Java method as being `native` and leave it without implementation
* You implement this method in C++, matching the exact function name and signature that JNI expects
* You put this method into a shared library bundled with your APK
* You load the library at runtime in Java code

After that, this method can be used from Java.

Let's see an example. The three basic things I need from my JNI layer is to be able to create a native application, tell it the screen size, and request a frame to be drawn. We could do something like that in Java:

{% highlight java %}
package your.application.name;

import android.app.Activity;

public class MainActivity extends Activity {
    private static native void createApp();
    private static native void resize(int width, int height);
    private static native void drawFrame();
}
{% endhighlight %}

Now, in our C++ code we define the following functions:

{% highlight cpp %}
#include <jni.h>

extern "C" void Java_your_application_name_MainActivity_createApp(JNIEnv * env, jclass clazz) {
    // Create the native app instance and store it somewhere
}

extern "C" void Java_your_application_name_MainActivity_resize(JNIEnv * env, jclass clazz, int width, int height) {
    // Call app.resize(width, height)
}

extern "C" void Java_your_application_name_MainActivity_drawFrame(JNIEnv * env, jclass clazz) {
    // Call app.drawFrame()
}
{% endhighlight %}

The `<jni.h>` file is supplied by the NDK.

The `extern "C"` here is crucial: it disables C++ name mangling and exports the function with exactly the name it has. This name is composed of several parts, all joined with underscores: `Java`, the package name, the class name, the method name. If the Java runtime fails to find the native method, it will crash and you'll see the name it was searching for in the logs. 

The signature of this method is either `(JNIEnv*, jclass, args...)` for a static method, or `(JNIEnv*, jobject, args...)` for a non-static method. One should be extremely careful with these function signatures. C++ name mangling turns function names into glibberish like `_ZN6psemek4util4spanIKcEC2EPS2_S4_` when compiling them to binaries; this glibberish, however, contains all the information about the function's namespace, enclosing class (if any), and argument types. This is what enables function overloading in C++, and this is what guards you from calling a function `void foo(int)` with an argument of type `std::string` from a different file.

C, however, doesn't do this. Function names are exported as they are, and nobody cares about parameter types. If you declare `..._resize` as `resize(int width, int height)`, the JNI will still call it with parameters `(JNIEnv*, jclass, int, int)`, so your `width` and `height` will be truncated pointer values, and the actual integer parameters will be missed. In this case, you'll just get absurd values for width and height, but in a more complicated scenario, when these parameters are some other Java objects, you'll get random crashes without any explanations. *I'm writing all this because I've spent a whole evening figuring out why my app was freezing in some asset loading method.*

### Using methods

We can call these JNI methods from the `RendererImpl` class we created earlier:

{% highlight java %}
class RendererImpl implements Renderer {
    @Override
    public void onSurfaceCreated(GL10 gl10, EGLConfig config) {
        MainActivity.this.createApp();
    }

    @Override
    public void onSurfaceChanged(GL10 gl10, int width, int height) {
        MainActivity.this.resize(width, height);
    }
    
    @Override
    public void onDrawFrame(GL10 gl10) {
        MainActivity.this.drawFrame();
    }
}
{% endhighlight %}

Note that the `Renderer` lives in a separete *render thread*, and all it's methods are called from that thread, not the main (*ui*) thread, which is where `onCreate` is called. Keep that in mind when calling your native methods.

These will crash, though, because we didn't load the shared library that implements them.

### Loading the library

Android APKs have a specific folder for native libraries: `lib/<abi>`. For `arm64-v8a`, we need to put all our shared libraries into `lib/arm64-v8a` and add this folder to the APK.

So, move all the shared libraries to `<somewhere>/lib/arm64-v8a/` (in my case these are `libpng16.so`, `libboost_random.so`, and the game's shared library). We also need the C++ standard library, which for some reason isn't present on the device; we can find it in `${NDK}/toolchains/llvm/prebuilt/linux-x86_64/sysroot/usr/lib/aarch64-linux-android/libc++_shared.so` -- copy it to `lib/arm64-v8a` as well.

Now, in the APK building process, somewhere after `aapt package` and before `zipalign`, add something like this:

```
${BUILD_TOOLS}/aapt add ./bin/myapp.unaligned.apk lib/arm64-v8a/*
```

This will add the shared libraries to the APK. Now we need to load them in Java, which is fairly straightforward:

{% highlight java %}
import java.lang.System;

// ...

@Override
protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    System.loadLibrary("MY_GAME_SHARED_LIBRARY_NAME");

    view = new ViewImpl(this);
    setContentView(view);
}
{% endhighlight %}

The argument to `loadLibrary` is the shared library name **without** the `lib` prefix and `.so` suffix. My game is called Tower Offense, it comes in a library `libtower-offense.so`, so I do `System.loadLibrary("tower-offense");`.

We don't need to explicitly load other libraries, since they'll get loaded by the runtime automatically as dependencies of our main library. *I had to load `boost_random` explicitly, though, probably due to some weirdness in it's `SONAME`. Not sure if it's still needed, though.*

### Exceptions

If you're using C++ exceptions like I do, note that we cannot let them propagate through the JNI boundary, i.e. no C++ exception can leave your native code, otherwise the Android runtime will crash. This means that we have to catch them and do something with them. We could log the error and return some error code from the native methods, but there's an arguably better solution: transform them into Java exceptions, which *can* propagate through JNI.

{% highlight cpp %}
extern "C" void Java_your_application_name_MainActivity_createApp(JNIEnv * env, jclass clazz) try
{
    // Try to create the app here
    ...
}
catch (std::exception const & e)
{
    env->ThrowNew(env->FindClass("java/lang/Exception"), e.what());
}
catch (...)
{
    env->ThrowNew(env->FindClass("java/lang/Exception"), "Unknown exception");
}
{% endhighlight %}

By now we should have an Android APK that contains a native library with a bunch of methods that are called from the Java code. That's already a win, but there's still a long way to go, because some parts of the native code still don't work.

## Stage 5: Fixing the broken

### Logging

If your logging simply writes to `stdout` (e.g. via `std::cout`) or `stderr`, I have bad knews: on Android, these [go to nowhere](https://stackoverflow.com/a/8870268/2315602) (namely, `/dev/null`). We can fix that by supplying our own `std::streambuf` implementation into `std::cout`; you can find [an example of how to do this](https://stackoverflow.com/a/8870278/2315602) in the same stackoverflow post.

However, for anything as big as a game engine it's better to use a dedicated logging library, which should support specifying different *sinks* -- things that receive all logging messages and put them somewhere, be it `std::cout`, a logging file, or the Android logs. I'm using my own logging library, and this is the whole implementation of this sink:

{% highlight cpp %}
struct sink_impl
    : log::sink
{
    void put_message(log::message const & msg) override
    {
        __android_log_write(log_priority(msg.level), "psemek", msg.message.data());
    }

    void flush() override
    {}
};
{% endhighlight %}

So, I convert my library's log priority type to Android enum, specify the tag (`"psemek"`, the name of my engine), and specify the log message (just a `const char *`). Now our logs can be seen on the device using e.g. `adb logcat`, which should help a lot during further debugging.

### OpenGL

We're using OpenGL ES 3.2 in our application, and to actually call the OpenGL ES API we can use a special class `android.opengl.GLES32`. However, my engine in all C++, so I'd need to pass this object to the native code and somehow forward my engine's OpenGL calls to this `GLES32` class. This sounds like a painful thing to do, and also the Native -> JNI -> Native roundtrip seems quite wasteful.

Another option is to use OpenGL like we normally do in native code: [load OpenGL functions](https://www.khronos.org/opengl/wiki/OpenGL_Loading_Library) manually at runtime. There are a handful of libraries that do that, [GLEW](https://glew.sourceforge.net) probably being the most well-known one. *I don't know if it supports OpenGL ES, though. It probably does.*

Of course, I've made [my own loading library](https://github.com/lisyarus/opengl-loader-generator), or rather a *loading library generator*. It is highly configurable, and generates a header & a source file for a specific OpenGL API version and a set of desired OpenGL extensions, and they do all the loading for you. It already supported OpenGL ES out of the box, but it didn't support Android, which turned out to be a matter of just [a couple lines of code](https://github.com/lisyarus/opengl-loader-generator/commit/7c2b901b0798388e75629af2ec1741c2c4d9c54d). Essentially I'm using EGL to load OpenGL functions on Android, which is a widespread OpenGL platform support library present on most modern-day systems.

My generator creates a header with all OpenGL functions for a particular API version, like OpenGL 3.3 or OpenGL ES 3.2. This means that if my engine uses something from OpenGL that isn't present in OpenGL ES 3.2, it simply won't compile (which is a good thing -- runtime errors are harder to debug). It turned out that, indeed, OpenGL ES lacks a few things, most importantly 1D textures, multisample textures, and certain pixel formats like packed `GL_RGB10` or 16-bit `GL_R16`.

The proper solution for this kind of problems is to move everything platform-specific to separate files, and only add them to the project on appropriate platforms. This doen't work well when these platform-specific things are e.g. class methods, which was my case as well. So, I used the simple solution of defining `PSEMEK_GLES` in my generated OpenGL ES header, and surround the problematic code with `#ifndef PSEMEK_GLES`.

One other problem I stumbled upon when porting to OpenGL ES is initializing depth textures. When you do `glTexImage2D` for a depth texture, you supply e.g. `internalFormat = GL_DEPTH_COMPONENT24`, and you are required to set `format = GL_DEPTH_COMPONENT`, but the `type` argument is, as far as I can see, completely ignored. However, in OpenGL ES you are *required* to pass `type = GL_UNSIGNED_INT` in this case. I was using `type = GL_UNSIGNED_BYTE` in this scenario for many years and never found any problem on desktop OpenGL.

Anyway, we load the OpenGL functions somewhere inside `Renderer.onSurfaceCreated`, e.g. in our `void createApp()` native method, and we should be good to go.

### Shaders

Now the OpenGL functions are here, but the shaders won't compile, for two reasons.

The first reason is GLSL version. GLSL (the shading languge used in OpenGL) requires all shaders to start with a line that goes like `#version 330 core`. Here, `330` is the GLSL version, and `core` is the OpenGL [profile](https://www.khronos.org/opengl/wiki/OpenGL_Context#Context_types). When using OpenGL ES, we need something like `#version 320 es` instead. So, we need some generic mechanism for prepending this or that line for any shader code depending on the platform.

The second reason is [precision qualifiers](https://www.khronos.org/opengl/wiki/Type_Qualifier_(GLSL)#Precision_qualifiers) -- something you might've never heard of if you only work with desktop OpenGL. In GLSL, you can specify that a certain variable has high, medium, or low precision, something like this: `highp float x = smth();`. You can also state that *all* variables of a particular type in this shader should have a certain precision by default, like this: `precision highp float;`.

The funny thing is that these qualifiers *do nothing* on desktop OpenGL, they only have meaning in OpenGL ES. What's worse, OpenGL ES *doesn't have* default precision qualifiers [in certain cases](https://stackoverflow.com/a/6336285/2315602), so if you declare a `float` variable in a fragment shader, you will get an error saying that it doesn't know which precision to use! We need to specify the default precision for this shader.

Specifying default precision in all shaders is quite tiresome, so instead I decided to prepend something like this in all my shaders on OpenGL ES:

```
#version 320 es

precision highp int;
precision highp float;
precision highp sampler2D;
precision highp usampler2D;
```

which also solves the version string problem. Similarly, on OpenGL 3.3 I prepend this insted:

```
#version 330 core
```

Of course, all this means we need a centralized mechanism for creating our shaders, but engines usually have such a mechanism anyway.

### Assets

Now our shaders compile, but the assets won't load. On desktop platforms, I simply put all the extra files required by the project in the ZIP archive together with the executable, and find them in a path relative to the executable location. We can't do that on Android, because the APK directory structure is pretty rigid, and because the APK never gets explicitly unpacked anyway (it is probably unpacked at runtime on demand, or smth like that).

Android has several mechanisms for packaging extra resource files with the APK. The obvious choice is the `res` directory in the APK. It has a very rigid structure, e.g. `res/drawables` should be various images you use, `res/values` should contain XML files with some strings or settings, etc. There's a `res/raw` directory which seems to be perfect for us, because it cares not what type of data we put there, but it also seems to have some strict rules about file naming, and I never figured out how to access it from native code anyway. The APK compilation process generates a special file called `R.java` which allows you to acces the resources, so I could forward each resource to the native code somehow, but again this sounds painful and wasteful.

There's another directory called `assets` which is perfect for us: you can put literally anything there, and there's an already existing native API for accessing that! Let me show you how it works.

In Java, we need to grab a special thing called `AssetManager` and pass it to our native code:

{% highlight java %}
// Somewhere in MainActivity class

private static native void setAssetManager(AssetManager assetManager);

@Override
protected void onCreate(Bundle savedInstanceState) {
    ...

    setAssetManager(this.getAssets());
}
{% endhighlight %}

Now, on the native side, we do

{% highlight cpp %}
#include <android/asset_manager_jni.h>

// Note the double AA in class name
static jobject assetManagerRef;
static AAssetManager * assetManager;

extern "C" Java_your_application_name_MainActivity_setAssetManager
    (JNIEnv * env, jclass clazz, jobject manager)
{
    assetManagerRef = env->NewLocalRef(manager);
    assetManager = AAssetManager_fromJava(env, manager);
}
{% endhighlight %}

We create a new reference to the `AssetManager` so that it doesn't get collected by GC, and then we convert the Java object into a native object using `AAssetManager_fromJava`. The `asset_manager_jni.h` file comes with the Android NDK.

Now to actually load some asset, we have a plethora of options. See the [documentation](https://developer.android.com/ndk/reference/group/asset) to learn about all them. [What I'm doing](https://bitbucket.org/lisyarus/psemek/src/master/libs/android/source/resource.cpp) is opening it with `AAssetManager_open` in `STREAMING` mode, and then wrap it into an implementation of my library's `istream` class which uses `AAsset_read` to read the asset.

We also better add some shutdown routine that releases the `assetManagerRef`, though I didn't do it just yet.

### Audio

Audio was probably the most complicated part of this whole stage. I'm using [my own audio library](https://lisyarus.github.io/blog/programming/2022/10/15/audio-mixing.html), which is mostly platform-independent. The only platform-specific part is the final audio sink -- the thing that takes the audio played by the engine and puts it somewhere.

On desktop [I'm using SDL](https://bitbucket.org/lisyarus/psemek/src/master/libs/sdl2/source/audio_engine.cpp) to output audio, which requires you to supply an *audio callback* -- a function which is called from the audio thread repeatedly to grab new audio samples. Android doesn't have such a thing, or at least I didn't find one, so I had to look into how SDL itself does audio on Adnroid.

They use the `android.media.AudioTrack` class. My first attempt was to create it in *offload* mode, and supply a `StreamEventCallback` which responds to the `onDataRequest` event to request more audio samples from my engine and [write](https://developer.android.com/reference/android/media/AudioTrack#write(float[],%20int,%20int,%20int)) them to the `AudioTrack`. The `StreamEventCallback` needs a special `Executor` to work, for which I used a `ThreadPoolExecutor` which also needs a `BlockingQueue` so I passed an `ArrayBlockingQueue` to it, geez. This worked, but the audio latency was too high, something on the order of half a second or so. If that seems good enough for you, trust me, it is not. My SDL audio backend has a latency of about 10 ms, which is good indeed.

I tried forcing the `AudioTrack` to use a smaller buffer size, but there's a minimal size of about 10000 samples (at least on my device) and it never allows you to use a smaller buffer. For comparison, my SDL audio backend uses a buffer of 512 samples (leading to theoretical latency of `512/44100 ~ 0.011` seconds at 44.1 kHz sampling frequency).

So, instead I created a dedicated `Thread` which repeatedly requests audio samples from the native code and writes them to the `AudioTrack` in a *blocking* mode, so that it doesn't run too much forward in time compared to `AudioTrack` internal buffers. Here's the implementation of this thread:

{% highlight java %}
private static native int audioGetSamples(float buffer[], int sampleOffset, int sampleCount);

private class AudioThreadImpl extends Thread {

    private float buffer[];

    public AudioThreadImpl(int bufferSizeInFrames) {
        super("audio");

        buffer = new float[bufferSizeInFrames * 2];
    }

    @Override
    public void run() {
        while (true) {
            int samples = PsemekApplication.audioGetSamples(buffer, 0, buffer.length);
            PsemekApplication.this.audioTrack.write(buffer, 0, samples, AudioTrack.WRITE_BLOCKING);
            try {
                Thread.sleep(1);
            }
            catch (InterruptedException e) {}
        }
    }
}
{% endhighlight %}

`audioGetSamples` is implemented on the C++ side, it grabs audio samples from the audio engine output. Here's the code for initializing the `AudioTrack`:

{% highlight java %}
AudioAttributes audioAttributes = new AudioAttributes.Builder()
    .setUsage(AudioAttributes.USAGE_GAME)
    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
    .build();

AudioFormat audioFormat = new AudioFormat.Builder()
    .setEncoding(AudioFormat.ENCODING_PCM_FLOAT)
    .setSampleRate(audioFrequencyNative())
    .setChannelMask(AudioFormat.CHANNEL_OUT_STEREO)
    .build();

int bufferSize = AudioTrack.getMinBufferSize(audioFrequencyNative(), AudioFormat.CHANNEL_OUT_STEREO, AudioFormat.ENCODING_PCM_FLOAT);

audioTrack = new AudioTrack.Builder()
    .setAudioAttributes(audioAttributes)
    .setAudioFormat(audioFormat)
    .setBufferSizeInBytes(bufferSize)
    .setTransferMode(AudioTrack.MODE_STREAM)
    .setPerformanceMode(AudioTrack.PERFORMANCE_MODE_LOW_LATENCY)
    .build();

audioThread = new AudioThreadImpl(audioTrack.getBufferCapacityInFrames());
audioThread.start();

audioTrack.play();
{% endhighlight %}

Note that I'm using floating-point stereo audio samples. If using `int16` or `int32` samples, the code needs a bit of tweaking.

I don't see how exactly this approach is so much different from the `StreamEventCallback`, but it works and produces audio with quite low latency, so there's that.

### Touch events

This is easy, but I'll mention it anyway. To support touch events, I implement the `GLSurfaceView.onTouchEvent` and added a corresponding native callback:

{% highlight java %}
private static native void onTouchEvent(int x, int y);

class ViewImpl extends GLSurfaceView {

    ...

    @Override
    public boolean onTouchEvent(MotionEvent e) {
        if (e.getAction() == MotionEvent.ACTION_DOWN) {
            MainActivity.onTouchEvent((int)e.getX(), (int)e.getY());
        }
        return true;
    }
}
{% endhighlight %}

This is the most basic approach; touch events are a bit more complicated and involve moving touches and multi-point touches, so we might need more involved native callbacks, but that's a start.

## Voila!

After all this hard work, here's what I got:

<center><video width="100%" controls><source src="{{site.url}}/blog/media/android/voila.mp4" type="video/mp4"></video></center>
<br>

Of course, making the game actually feel good on mobile devices is a completely different story, but I feel like the hardest part is over.

I've wrapped the whole android packaging process in a docker container. Here's the [Dockerfile](https://bitbucket.org/lisyarus/psemek/src/master/package/android/Dockerfile) that creates the container, and here's the [packaging script](https://bitbucket.org/lisyarus/psemek/src/master/package/android/package.sh) that runs inside that container. And here's my [android backend library](https://bitbucket.org/lisyarus/psemek/src/master/libs/android). All these things contain a lot of stuff specific to my engine, but the general outline coincides with the content of this article.

This is the longest article I've written so far, and the process I've described took me a long week of trial and error. If you find some errors or inconsistencies in it, be sure to ping me (e.g. via email), I'll be happy to fix them. Nothing hurts more than tutorials that don't work :)

{% include end_section.html %}
