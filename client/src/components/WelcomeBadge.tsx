import { useState, useEffect, useRef } from 'react';
import { Canvas, extend, useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { 
  BallCollider, 
  CuboidCollider, 
  Physics, 
  RigidBody,
  useRopeJoint, 
  useSphericalJoint 
} from '@react-three/rapier';
import { MeshLineGeometry, MeshLineMaterial } from 'meshline';
import { Text, Environment } from '@react-three/drei';

// Extend JSX.IntrinsicElements with meshLine types
declare global {
  namespace JSX {
    interface IntrinsicElements {
      meshLineGeometry: any;
      meshLineMaterial: any;
    }
  }
}

extend({ MeshLineGeometry, MeshLineMaterial });

interface WelcomeBadgeProps {
  username: string;
  onClose: () => void;
}

interface DragState {
  x: number;
  y: number;
  z: number;
}

export default function WelcomeBadge({ username, onClose }: WelcomeBadgeProps) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    console.log("Welcome badge mounted");
    const timer = setTimeout(() => {
      setShow(false);
      onClose();
    }, 10000); // Increased time to 10 seconds for better interaction

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('canvas')) {
        setShow(false);
        onClose();
      }
    };

    document.addEventListener('click', handleClickOutside);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [onClose]);

  if (!show) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 9999,
        pointerEvents: 'all',
        backgroundColor: 'rgba(0,0,0,0.5)'
      }}
    >
      <Canvas 
        camera={{ position: [0, 0, 13], fov: 25 }}
        style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%'
        }}
      >
        <color attach="background" args={['transparent']} />
        <ambientLight intensity={Math.PI} />
        <Physics 
          interpolate 
          gravity={[0, -40, 0]} 
          timeStep={1 / 60}
        >
          <Badge username={username} />
        </Physics>
        <Environment preset="city" />
      </Canvas>
    </div>
  );
}

function Badge({ username }: { username: string }) {
  const band = useRef<THREE.Mesh>(null);
  const fixed = useRef<any>(null);
  const j1 = useRef<any>(null);
  const j2 = useRef<any>(null);
  const j3 = useRef<any>(null);
  const card = useRef<any>(null);

  const vec = new THREE.Vector3();
  const ang = new THREE.Vector3();
  const rot = new THREE.Vector3();
  const dir = new THREE.Vector3();

  const { width, height } = useThree((state) => state.size);
  const [curve] = useState(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3()
    ]);
    curve.curveType = 'centripetal'; // Better curve interpolation
    return curve;
  });

  const [dragged, drag] = useState<DragState | false>(false);
  const [hovered, hover] = useState(false);

  const segmentProps = {
    type: 'dynamic' as const,
    canSleep: true,
    colliders: 'ball' as const,
    angularDamping: 2,
    linearDamping: 2
  };

  useEffect(() => {
    if (hovered) {
      document.body.style.cursor = dragged ? 'grabbing' : 'grab';
      return () => { document.body.style.cursor = 'auto'; };
    }
  }, [hovered, dragged]);

  useRopeJoint(fixed, j1, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j1, j2, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j2, j3, [[0, 0, 0], [0, 0, 0], 1]);
  useSphericalJoint(j3, card, [[0, 0, 0], [0, 1.45, 0]]);

  useFrame((state, delta) => {
    if (dragged && card.current) {
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
      dir.copy(vec).sub(state.camera.position).normalize();
      vec.add(dir.multiplyScalar(state.camera.position.length()));
      card.current.setNextKinematicTranslation({
        x: vec.x - dragged.x,
        y: vec.y - dragged.y,
        z: vec.z - dragged.z
      });
      [card, j1, j2, j3, fixed].forEach((ref) => ref.current?.wakeUp());
    }

    if (fixed.current) {
      // Fix most of the jitter when over pulling the card
      [j1, j2].forEach((ref) => {
        if (!ref.current.lerped) ref.current.lerped = new THREE.Vector3().copy(ref.current.translation());
        const clampedDistance = Math.max(0.1, Math.min(1, ref.current.lerped.distanceTo(ref.current.translation())));
        ref.current.lerped.lerp(ref.current.translation(), delta * (10 + clampedDistance * 40));
      });

      // Update curve points for the band
      if (band.current && j3.current?.translation) {
        curve.points[0].copy(j3.current.translation());
        curve.points[1].copy(j2.current.lerped);
        curve.points[2].copy(j1.current.lerped);
        curve.points[3].copy(fixed.current.translation());

        // @ts-ignore - meshline types are not properly defined
        band.current.geometry.setPoints(curve.getPoints(32));
      }
    }

    if (card.current) {
      ang.copy(card.current.angvel());
      rot.copy(card.current.rotation());
      // Smoother rotation damping
      card.current.setAngvel({ 
        x: ang.x * 0.95, 
        y: ang.y - rot.y * 0.25, 
        z: ang.z * 0.95 
      });
    }
  });

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
        <RigidBody 
          position={[2, 0, 0]} 
          ref={card} 
          {...segmentProps}
          type={dragged ? 'kinematicPosition' : 'dynamic'}
        >
          <CuboidCollider args={[0.8, 1.125, 0.01]} />
          <group
            scale={2.25}
            position={[0, -1.2, -0.05]}
            onPointerOver={() => hover(true)}
            onPointerOut={() => hover(false)}
            onPointerUp={(e) => {
              e.stopPropagation();
              drag(false);
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              const point = new THREE.Vector3().copy(e.point);
              const translation = new THREE.Vector3().copy(card.current!.translation());
              drag({
                x: point.x - translation.x,
                y: point.y - translation.y,
                z: point.z - translation.z
              });
            }}
          >
            <mesh>
              <boxGeometry args={[1.6, 2.25, 0.02]} />
              <meshPhysicalMaterial 
                color="#ffffff"
                clearcoat={1}
                clearcoatRoughness={0.15}
                roughness={0.3}
                metalness={0.5}
                iridescence={1}
                iridescenceIOR={1}
                iridescenceThicknessRange={[0, 2400]}
              />
            </mesh>
            <Text
              position={[0, 0.2, 0.02]}
              fontSize={0.2}
              color="black"
              anchorX="center"
              anchorY="middle"
            >
              Welcome
            </Text>
            <Text
              position={[0, -0.2, 0.02]}
              fontSize={0.25}
              color="black"
              anchorX="center"
              anchorY="middle"
            >
              {username}
            </Text>
          </group>
        </RigidBody>
      </group>
      <mesh ref={band}>
        <meshLineGeometry />
        <meshLineMaterial 
          color="#4a90e2"
          resolution={[width, height]}
          lineWidth={1}
        />
      </mesh>
    </>
  );
}