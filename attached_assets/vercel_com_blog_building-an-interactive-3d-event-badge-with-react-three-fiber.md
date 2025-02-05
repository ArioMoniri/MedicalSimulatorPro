URL: https://vercel.com/blog/building-an-interactive-3d-event-badge-with-react-three-fiber
---
[Blog](https://vercel.com/blog) / **[Engineering](https://vercel.com/blog/category/engineering)**

# Building an interactive 3D event badge with React Three Fiber

[![Avatar for drcmda](https://vercel.com/api/www/avatar?u=drcmda&s=40)\\
Paul HenschelDesign Engineer](https://twitter.com/0xca0a)

5 min read

Apr 17, 2024

In this post, we’ll look at how we made the dropping lanyard for the [Vercel Ship 2024 site](https://vercel.com/ship), diving into the inspiration, tech stack, and code behind the finished product.

## [Inspiration](https://vercel.com/blog/building-an-interactive-3d-event-badge-with-react-three-fiber\#inspiration)

We’ve shared digital tickets for event attendance in the past, but this time, we wanted to take it one step further by creating a tangible experience.

When [Studio Basement](https://basement.studio/) made a video in Blender that depicted a virtual badge dropping down, we liked the idea of it so much that we started to wonder whether we could make it interactive and run it in the browser.

Ultimately, we wanted a highly shareable element that rewards the user for signing up and makes it worth their time.

## [The stack](https://vercel.com/blog/building-an-interactive-3d-event-badge-with-react-three-fiber\#the-stack)

To accomplish the task, we chose the following stack:

- Blender, to prepare and optimize the original models for the web

- React and [React Three Fiber](https://github.com/pmndrs/react-three-fiber), which is a reactive, declarative renderer for [Three.js](https://threejs.org/)

- [Drei](https://github.com/pmndrs/drei), an ecosystem of components and helpers for the Three.js space in React

- [`react-three-rapier`](https://github.com/pmndrs/react-three-rapier), a declarative physics library based on the [Dimforge Rapier physics engine](https://rapier.rs/)

- [MeshLine](https://github.com/pmndrs/meshline), a shader-based thick-line implementation


While some of the concepts we’re about to cover may not look familiar, don’t let them overwhelm you. The implementation is about 80 lines of mostly declarative code, with a sprinkle of math.

Check out this sandbox first to get an idea of what we’re building:

App.jsindex.jsstyles.css

To enter the code editing mode, press Enter. To exit the edit mode, press Escape

You are editing the code. To exit the edit mode, press Escape

99

1

2

3

4

5

6

7

8

9

10

11

12

13

14

15

16

17

18

19

20

21

22

23

24

25

26

27

28

29

30

31

32

33

34

35

36

import\*asTHREEfrom'three'

import{useRef,useState}from'react'

import{Canvas,extend,useThree,useFrame}from'@react-three/fiber'

import{BallCollider,CuboidCollider,Physics,RigidBody,useRopeJoint,useSphericalJoint}from'@react-three/rapier'

import{MeshLineGeometry,MeshLineMaterial}from'meshline'

extend({MeshLineGeometry,MeshLineMaterial})

exportdefaultfunctionApp(){

return(

<Canvascamera={{position:\[0,0,13\],fov:25}}>

<Physicsdebuginterpolategravity={\[0, -40,0\]}timeStep={1 / 60}>

<Band/>

</Physics>

</Canvas>

)

}

functionBand(){

constband = useRef(),fixed = useRef(),j1 = useRef(),j2 = useRef(),j3 = useRef(),card = useRef()// prettier-ignore

constvec = newTHREE.Vector3(),ang = newTHREE.Vector3(),rot = newTHREE.Vector3(),dir = newTHREE.Vector3()// prettier-ignore

const{width,height} = useThree((state)=>state.size)

const\[curve\] = useState(()=>newTHREE.CatmullRomCurve3(\[newTHREE.Vector3(),newTHREE.Vector3(),newTHREE.Vector3(),newTHREE.Vector3()\]))

const\[dragged,drag\] = useState(false)

useRopeJoint(fixed,j1,\[\[0,0,0\],\[0,0,0\],1\])// prettier-ignore

useRopeJoint(j1,j2,\[\[0,0,0\],\[0,0,0\],1\])// prettier-ignore

useRopeJoint(j2,j3,\[\[0,0,0\],\[0,0,0\],1\])// prettier-ignore

useSphericalJoint(j3,card,\[\[0,0,0\],\[0,1.45,0\]\])// prettier-ignore

useFrame((state,delta)=>{

if(dragged){

vec.set(state.pointer.x,state.pointer.y,0.5).unproject(state.camera)

dir.copy(vec).sub(state.camera.position).normalize()

vec.add(dir.multiplyScalar(state.camera.position.length()))

;\[card,j1,j2,j3,fixed\].forEach((ref)=>ref.current?.wakeUp())

Refresh previewOpen on CodeSandbox

## [Building a rough draft](https://vercel.com/blog/building-an-interactive-3d-event-badge-with-react-three-fiber\#building-a-rough-draft)

The basic imports we need revolve around our canvas, physics, and the thick line for the lanyard:

App.js

```code-block_code__isn_V

import * as THREE from 'three'

import { useRef, useState } from 'react'

import { Canvas, extend, useThree, useFrame } from '@react-three/fiber'

import { BallCollider, CuboidCollider, Physics, RigidBody, useRopeJoint, useSphericalJoint } from '@react-three/rapier'

import { MeshLineGeometry, MeshLineMaterial } from 'meshline'
```

In order to use the MeshLine library, which is vanilla Three.js in React, we need to [extend it](https://docs.pmnd.rs/react-three-fiber/api/objects#using-3rd-party-objects-declaratively). The `extend` function extends React Three Fiber's catalog of known JSX elements. Components added this way can then be referenced in the scene graph using camel casing, similar to native primitives (e.g., `<mesh>`):

App.js

```code-block_code__isn_V

extend({ MeshLineGeometry, MeshLineMaterial })
```

### [Setting up the canvas](https://vercel.com/blog/building-an-interactive-3d-event-badge-with-react-three-fiber\#setting-up-the-canvas)

Now we can set up a basic canvas. We need React Three Fiber’s `<Canvas>` component, which is a doorway into declarative Three.js. We also add a `<Physics>` provider, which allows us to tie shapes to physics; in Rapier, this is called a `<RigidBody>`.

With this, we have everything we need:

App.js

```code-block_code__isn_V

export default function App() {

  return (

    <Canvas>

      <Physics>

        {/* ... */}

      </Physics>

    </Canvas>

  )

}
```

## [The band component](https://vercel.com/blog/building-an-interactive-3d-event-badge-with-react-three-fiber\#the-band-component)

Now let’s make the band happen. We need a couple of references to access them later on. The canvas size is important for `meshline`, and a `THREE.CatmullRomCurve3` helps us to calculate a smooth curve with just a few points. We only need four points for the physics joints:

App.js

```code-block_code__isn_V

function Band() {

  // References for the band and the joints

  const band = useRef()

  const fixed = useRef()

  const j1 = useRef()

  const j2 = useRef()

  const j3 = useRef()

  // Canvas size

  const { width, height } = useThree((state) => state.size)

  // A Catmull-Rom curve

  const [curve] = useState(() => new THREE.CatmullRomCurve3([\
\
    new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()\
\
  ]))
```

### [Defining the physics joints](https://vercel.com/blog/building-an-interactive-3d-event-badge-with-react-three-fiber\#defining-the-physics-joints)

A joint is a physics constraint that tells the engine how shapes interact with one another. We’ll now start to connect the joints, and we’ll later define a fixed `<RigidBody>` that cannot move.

We hang the first joint on the `useRopeJoint` the Rapier provides (there are a lot of different constraints for rotations, distances, etc.). The other joints will hang on each other. Basically, we will have made a chain that hangs on a fixed point.

`useRopeJoint` requires two `<RigidBody>` references:

1. Two anchor points for each (we’re using `[0, 0, 0]`, which is the center point)

2. A length (we’re using `1`)


Our rope is ready to swing!

App.js

```code-block_code__isn_V

  useRopeJoint(fixed, j1, [[0, 0, 0], [0, 0, 0], 1])

  useRopeJoint(j1, j2, [[0, 0, 0], [0, 0, 0], 1])

  useRopeJoint(j2, j3, [[0, 0, 0], [0, 0, 0], 1])
```

### [Creating a curve](https://vercel.com/blog/building-an-interactive-3d-event-badge-with-react-three-fiber\#creating-a-curve)

Rapier will now move the joints along an invisible rope, and we can feed our [Catmull-Rom curve](https://threejs.org/docs/#api/en/extras/curves/CatmullRomCurve3) the positions of these joints. We let it make a smooth, interpolated curve with 32 points and forward that to the `meshline`.

We do this at runtime at 60 or 120 FPS, depending on the monitor’s refresh rate. React Three Fiber gives us an out to handle frame-based animations with the `useFrame` Hook:

App.js

```code-block_code__isn_V

  useFrame(() => {

    curve.points[0].copy(j3.current.translation())

    curve.points[1].copy(j2.current.translation())

    curve.points[2].copy(j1.current.translation())

    curve.points[3].copy(fixed.current.translation())

    band.current.geometry.setPoints(curve.getPoints(32))

  })
```

### [The view](https://vercel.com/blog/building-an-interactive-3d-event-badge-with-react-three-fiber\#the-view)

Now we need the view. It consists of the fixed `<RigidBody type="fixed">`, three `<RigidBody>`'s for the joints ( `j1`, `j2`, and `j3`), and the `meshline` that we extended above. The joints are positioned in a way that makes them fall down with a slight swing:

App.js

```code-block_code__isn_V

  return (

    <>

      <RigidBody ref={fixed} type="fixed" />

      <RigidBody position={[0.5, 0, 0]} ref={j1}>

        <BallCollider args={[0.1]} />

      </RigidBody>

      <RigidBody position={[1, 0, 0]} ref={j2}>

        <BallCollider args={[0.1]} />

      </RigidBody >

      <RigidBody position={[1.5, 0, 0]} ref={j3}>

        <BallCollider args={[0.1]} />

      </RigidBody >

      <mesh ref={band}>

        <meshLineGeometry />

        <meshLineMaterial color="white" resolution={[width, height]} lineWidth={1} />

      </mesh>

    </>

  )

}
```

## [The card component](https://vercel.com/blog/building-an-interactive-3d-event-badge-with-react-three-fiber\#the-card-component)

All that’s missing is the interactive card, which we need to attach to the end of the last joint. For this, we’ll need a new reference, some variables for math, a state for dragging, and a new joint. This time, we use a spherical joint so the card can rotate:

App.js

```code-block_code__isn_V

  const card = useRef()

  const vec = new THREE.Vector3()

  const ang = new THREE.Vector3()

  const rot = new THREE.Vector3()

  const dir = new THREE.Vector3()

  const [dragged, drag] = useState(false)

  useSphericalJoint(j3, card, [[0, 0, 0], [0, 1.45, 0]])
```

Rapier defines a few rigid-body types:

- `fixed`, which isn’t affected by anything

- `dynamic`, the default, which reacts to any other rigid body

- `kinematicPosition`, which is the position controlled by the user, not the engine


The card needs to be kinematic when dragged and dynamic when it’s not. We will later use `pointerEvents` to set the `dragged` state.

Our previous `useFrame` now changes to this:

App.js

```code-block_code__isn_V

  useFrame((state) => {

    if (dragged) {

      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera)

      dir.copy(vec).sub(state.camera.position).normalize()

      vec.add(dir.multiplyScalar(state.camera.position.length()))

      card.current.setNextKinematicTranslation({ x: vec.x - dragged.x, y: vec.y - dragged.y, z: vec.z - dragged.z })

    }

    // Calculate Catmull curve

    curve.points[0].copy(j3.current.translation())

    curve.points[1].copy(j2.current.translation())

    curve.points[2].copy(j1.current.translation())

    curve.points[3].copy(fixed.current.translation())

    band.current.geometry.setPoints(curve.getPoints(32))

    // Tilt the card back towards the screen

    ang.copy(card.current.angvel())

    rot.copy(card.current.rotation())

    card.current.setAngvel({ x: ang.x, y: ang.y - rot.y * 0.25, z: ang.z })

  })
```

Calculating the dragged state is the complicated bit of the code. Without going into too much detail, if you want to translate a pointer event coordinate to a 3D object, this is called a camera unprojection. Three.js has a method for this, `unproject(state.camera)`, which does most of the math.

The obtained vector gets applied as a kinematic translation. We move the card with the mouse/trackpad, and the lanyard joints will follow it where it goes.

Another hard nut to crack is that we allow the card to rotate, but we want it to always rotate from back to front—which is not physically accurate, of course, but the experience would suffer otherwise. To solve this, we use the current rotational velocity `card.current.angvel()` and the rotation `card.current.rotation()`, and spin the y-axis towards the front.

### [The card’s rigid body and pointer events](https://vercel.com/blog/building-an-interactive-3d-event-badge-with-react-three-fiber\#the-card%E2%80%99s-rigid-body-and-pointer-events)

We use a `<CuboidCollider>` (a box shape) for the card and drop a `<mesh>` inside that will move along with the `<RigidBody>`. This mesh will later be exchanged with the Blender model.

The pointer events for up and down set the `drag` state. On the down point, we grab the current point of the model, `e.point`, and subtract the card’s position in space, `card.current.translation()`. We need this offset for the `useFrame` above to calculate the correct kinematic position:

App.js

```code-block_code__isn_V

      <RigidBody ref={card} type={dragged ? 'kinematicPosition' : 'dynamic'} >

        <CuboidCollider args={[0.8, 1.125, 0.01]} />

        <mesh

          onPointerUp={(e) => drag(false)}

          onPointerDown={(e) => drag(new THREE.Vector3().copy(e.point).sub(vec.copy(card.current.translation())))}>

          <planeGeometry args={[0.8 * 2, 1.125 * 2]} />

          <meshBasicMaterial color="white" side={THREE.DoubleSide} />

        </mesh>

      </RigidBody>
```

## [Adding the dynamic name](https://vercel.com/blog/building-an-interactive-3d-event-badge-with-react-three-fiber\#adding-the-dynamic-name)

We wanted the card to display the name of the user dynamically. To achieve that, we’ll create a new scene that renders the user's name alongside a base texture. Then, we’ll use Drei's `<RenderTexture>` component to render that scene into a texture.

We start by creating a scene that renders the base of the badge texture:

App.js

```code-block_code__isn_V

<PerspectiveCamera makeDefault manual aspect={1.05} position={[0.49, 0.22, 2]} />

<mesh>

  <planeGeometry args={[planeWidth, -planeWidth / textureAspect]} />

  <meshBasicMaterial transparent alphaMap={texture} side={THREE.BackSide} />

</mesh>
```

![The result of using Drei's <RenderTexture> component to render our badge texture.](https://vercel.com/_next/image?url=https%3A%2F%2Fassets.vercel.com%2Fimage%2Fupload%2Fcontentful%2Fimage%2Fe5382hct74si%2F1Vc0zyPPeXyKaxIZTDxfSz%2F57affd4018172d97483a5705206d9328%2Fvercel-ship-badge-texture.png&w=1920&q=75)The result of using Drei's <RenderTexture> component to render our badge texture.

We have the badge texture, but we’re still missing the name. We’ll add it to the scene using Drei's `<Text3D>` component:

App.js

```code-block_code__isn_V

<Center bottom right>

  <Resize key={resizeId} maxHeight={0.45} maxWidth={0.925}>

    <Text3D

      bevelEnabled={false}

      bevelSize={0}

      font="/ship/2024/badge/Geist_Regular.json"

      height={0}

      rotation={[0, Math.PI, Math.PI]}>

      {user.firstName}

    </Text3D>

    <Text3D

      bevelEnabled={false}

      bevelSize={0}

      font="/ship/2024/badge/Geist_Regular.json"

      height={0}

      position={[0, 1.4, 0]}

      rotation={[0, Math.PI, Math.PI]}>

      {user.lastName}

    </Text3D>

  </Resize>

</Center>
```

This is an entirely different scene—we want to add the result of the render into our badge as a color. We achieve this using the `<RenderTexture>` component, which will render our scene into a texture we can attach to the `mesh.map`:

App.js

```code-block_code__isn_V

<mesh geometry={nodes.card.geometry}>

  <meshPhysicalMaterial

    clearcoat={1}

    clearcoatRoughness={0.15}

    iridescence={1}

    iridescenceIOR={1}

    iridescenceThicknessRange={[0, 2400]}

    metalness={0.5}

    roughness={0.3}

  >

    <RenderTexture attach="map" height={2000} width={2000}>

      <BadgeTexture user={user} />

    </RenderTexture>

  </meshPhysicalMaterial>

</mesh>
```

## [Finishing touches](https://vercel.com/blog/building-an-interactive-3d-event-badge-with-react-three-fiber\#finishing-touches)

We have everything in place now. The basic meshes are quickly changed out for the Blender models, and with a little bit of tweaking and math, we make the simulation more stable and less shaky. Here's the sandbox we used to prototype the component for the Ship site:

App.jsindex.jsstyles.css

```
import * as THREE from 'three'
import { useEffect, useRef, useState } from 'react'
import { Canvas, extend, useThree, useFrame } from '@react-three/fiber'
import { useGLTF, useTexture, Environment, Lightformer } from '@react-three/drei'
import { BallCollider, CuboidCollider, Physics, RigidBody, useRopeJoint, useSphericalJoint } from '@react-three/rapier'
import { MeshLineGeometry, MeshLineMaterial } from 'meshline'
import { useControls } from 'leva'

extend({ MeshLineGeometry, MeshLineMaterial })
useGLTF.preload('https://assets.vercel.com/image/upload/contentful/image/e5382hct74si/5huRVDzcoDwnbgrKUo1Lzs/53b6dd7d6b4ffcdbd338fa60265949e1/tag.glb')
useTexture.preload('https://assets.vercel.com/image/upload/contentful/image/e5382hct74si/SOT1hmCesOHxEYxL7vkoZ/c57b29c85912047c414311723320c16b/band.jpg')

export default function App() {
  const { debug } = useControls({ debug: false })
  return (
    <Canvas camera={{ position: [0, 0, 13], fov: 25 }}>
      <ambientLight intensity={Math.PI} />
      <Physics debug={debug} interpolate gravity={[0, -40, 0]} timeStep={1 / 60}>
        <Band />
      </Physics>
      <Environment background blur={0.75}>
        <color attach="background" args={['black']} />
        <Lightformer intensity={2} color="white" position={[0, -1, 5]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
        <Lightformer intensity={3} color="white" position={[-1, -1, 1]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
        <Lightformer intensity={3} color="white" position={[1, 1, 1]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
        <Lightformer intensity={10} color="white" position={[-10, 0, 14]} rotation={[0, Math.PI / 2, Math.PI / 3]} scale={[100, 10, 1]} />
      </Environment>
    </Canvas>
  )
}

function Band({ maxSpeed = 50, minSpeed = 10 }) {
  const band = useRef(), fixed = useRef(), j1 = useRef(), j2 = useRef(), j3 = useRef(), card = useRef() // prettier-ignore
  const vec = new THREE.Vector3(), ang = new THREE.Vector3(), rot = new THREE.Vector3(), dir = new THREE.Vector3() // prettier-ignore
  const segmentProps = { type: 'dynamic', canSleep: true, colliders: false, angularDamping: 2, linearDamping: 2 }
  const { nodes, materials } = useGLTF('https://assets.vercel.com/image/upload/contentful/image/e5382hct74si/5huRVDzcoDwnbgrKUo1Lzs/53b6dd7d6b4ffcdbd338fa60265949e1/tag.glb')
  const texture = useTexture('https://assets.vercel.com/image/upload/contentful/image/e5382hct74si/SOT1hmCesOHxEYxL7vkoZ/c57b29c85912047c414311723320c16b/band.jpg')
  const { width, height } = useThree((state) => state.size)
  const [curve] = useState(() => new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]))
  const [dragged, drag] = useState(false)
  const [hovered, hover] = useState(false)

  useRopeJoint(fixed, j1, [[0, 0, 0], [0, 0, 0], 1]) // prettier-ignore
  useRopeJoint(j1, j2, [[0, 0, 0], [0, 0, 0], 1]) // prettier-ignore
  useRopeJoint(j2, j3, [[0, 0, 0], [0, 0, 0], 1]) // prettier-ignore
  useSphericalJoint(j3, card, [[0, 0, 0], [0, 1.45, 0]]) // prettier-ignore

  useEffect(() => {
    if (hovered) {
      document.body.style.cursor = dragged ? 'grabbing' : 'grab'
      return () => void (document.body.style.cursor = 'auto')
    }
  }, [hovered, dragged])

  useFrame((state, delta) => {
    if (dragged) {
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera)
      dir.copy(vec).sub(state.camera.position).normalize()
      vec.add(dir.multiplyScalar(state.camera.position.length()))
      ;[card, j1, j2, j3, fixed].forEach((ref) => ref.current?.wakeUp())
      card.current?.setNextKinematicTranslation({ x: vec.x - dragged.x, y: vec.y - dragged.y, z: vec.z - dragged.z })
    }
    if (fixed.current) {
      // Fix most of the jitter when over pulling the card
      ;[j1, j2].forEach((ref) => {
        if (!ref.current.lerped) ref.current.lerped = new THREE.Vector3().copy(ref.current.translation())
        const clampedDistance = Math.max(0.1, Math.min(1, ref.current.lerped.distanceTo(ref.current.translation())))
        ref.current.lerped.lerp(ref.current.translation(), delta * (minSpeed + clampedDistance * (maxSpeed - minSpeed)))
      })
      // Calculate catmul curve
      curve.points[0].copy(j3.current.translation())
      curve.points[1].copy(j2.current.lerped)
      curve.points[2].copy(j1.current.lerped)
      curve.points[3].copy(fixed.current.translation())
      band.current.geometry.setPoints(curve.getPoints(32))
      // Tilt it back towards the screen
      ang.copy(card.current.angvel())
      rot.copy(card.current.rotation())
      card.current.setAngvel({ x: ang.x, y: ang.y - rot.y * 0.25, z: ang.z })
    }
  })

  curve.curveType = 'chordal'
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping

  return (
    <>
      <group position={[0, 4, 0]}>
        <RigidBody ref={fixed} {...segmentProps} type="fixed" />
        <RigidBody position={[0.5, 0, 0]} ref={j1} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1, 0, 0]} ref={j2} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1.5, 0, 0]} ref={j3} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[2, 0, 0]} ref={card} {...segmentProps} type={dragged ? 'kinematicPosition' : 'dynamic'}>
          <CuboidCollider args={[0.8, 1.125, 0.01]} />
          <group
            scale={2.25}
            position={[0, -1.2, -0.05]}
            onPointerOver={() => hover(true)}
            onPointerOut={() => hover(false)}
            onPointerUp={(e) => (e.target.releasePointerCapture(e.pointerId), drag(false))}
            onPointerDown={(e) => (e.target.setPointerCapture(e.pointerId), drag(new THREE.Vector3().copy(e.point).sub(vec.copy(card.current.translation()))))}>
            <mesh geometry={nodes.card.geometry}>
              <meshPhysicalMaterial map={materials.base.map} map-anisotropy={16} clearcoat={1} clearcoatRoughness={0.15} roughness={0.3} metalness={0.5} />
            </mesh>
            <mesh geometry={nodes.clip.geometry} material={materials.metal} material-roughness={0.3} />
            <mesh geometry={nodes.clamp.geometry} material={materials.metal} />
          </group>
        </RigidBody>
      </group>
      <mesh ref={band}>
        <meshLineGeometry />
        <meshLineMaterial color="white" depthTest={false} resolution={[width, height]} useMap map={texture} repeat={[-3, 1]} lineWidth={1} />
      </mesh>
    </>
  )
}
```

To enter the code editing mode, press Enter. To exit the edit mode, press Escape

You are editing the code. To exit the edit mode, press Escape

Open on CodeSandbox

And that's it! Once you get the hang of the basics and start playing with simple shapes, the possibilities are endless.

[**Get your virtual badge.**\\
\\
Register for Vercel Ship '24 to learn about AI-native user experiences, building composable web applications, and the latest from our partners and community.\\
\\
Register Today](https://vercel.com/ship/ticket)

## Explore

[Blog post\\
\\
Apr 9, 2024\\
\\
**Composable AI for ecommerce: Hands-on with Vercel’s AI SDK** \\
\\
![Avatar for cramforce](https://vercel.com/api/www/avatar?u=cramforce&s=40)\\
\\
Malte Ubl](https://vercel.com/blog/composable-ai-for-ecommerce-hands-on-with-vercels-ai-sdk) [Blog post\\
\\
Nov 29, 2023\\
\\
**Guide to fast websites with Next.js: Tips for maximizing server speeds and minimizing client burden** \\
\\
![Avatar for siffogh](https://vercel.com/api/www/avatar?u=siffogh&s=40)\\
\\
Seif Ghezala](https://vercel.com/blog/guide-to-fast-websites-with-next-js-tips-for-maximizing-server-speeds)

**Ready to deploy?** Start building with a free account. Speak to an expert for your _Pro_ or Enterprise needs.

[Start Deploying](https://vercel.com/new) [Contact Sales](https://vercel.com/contact/sales)

**Explore Vercel Enterprise** with an interactive product tour, trial, or a personalized demo.

[Explore Enterprise](https://vercel.com/try-enterprise)