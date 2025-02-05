import * as THREE from 'three';
import { useRef, useState, useEffect } from 'react';
import { Canvas, extend, useThree, useFrame } from '@react-three/fiber';
import { 
  BallCollider, 
  CuboidCollider, 
  Physics, 
  RigidBody,
  RigidBodyApi,
  useRopeJoint, 
  useSphericalJoint 
} from '@react-three/rapier';
import { MeshLineGeometry, MeshLineMaterial } from 'meshline';
import { Text, PerspectiveCamera, Environment, useTexture } from '@react-three/drei';

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
    }, 3000);

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
        zIndex: 1000,
        pointerEvents: 'none'
      }}
    >
      <Canvas camera={{ position: [0, 0, 13], fov: 25 }}>
        <color attach="background" args={['transparent']} />
        <ambientLight intensity={Math.PI} />
        <Physics interpolate gravity={[0, -40, 0]} timeStep={1 / 60}>
          <Badge username={username} />
        </Physics>
        <Environment preset="city" />
      </Canvas>
    </div>
  );
}

function Badge({ username }: { username: string }) {
  const band = useRef<THREE.Mesh>(null);
  const fixed = useRef<RigidBodyApi>(null);
  const j1 = useRef<RigidBodyApi>(null);
  const j2 = useRef<RigidBodyApi>(null);
  const j3 = useRef<RigidBodyApi>(null);
  const card = useRef<RigidBodyApi>(null);

  const vec = new THREE.Vector3();
  const ang = new THREE.Vector3();
  const rot = new THREE.Vector3();
  const dir = new THREE.Vector3();

  const { width, height } = useThree((state) => state.size);
  const [curve] = useState(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3()
  ]));

  const [dragged, drag] = useState<DragState | false>(false);
  const [hovered, hover] = useState(false);

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

  useFrame((state) => {
    if (dragged && card.current) {
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
      dir.copy(vec).sub(state.camera.position).normalize();
      vec.add(dir.multiplyScalar(state.camera.position.length()));
      card.current.setNextKinematicTranslation({
        x: vec.x - dragged.x,
        y: vec.y - dragged.y,
        z: vec.z - dragged.z
      });
    }

    if (
      j3.current?.translation && 
      j2.current?.translation && 
      j1.current?.translation && 
      fixed.current?.translation && 
      band.current
    ) {
      curve.points[0].copy(j3.current.translation());
      curve.points[1].copy(j2.current.translation());
      curve.points[2].copy(j1.current.translation());
      curve.points[3].copy(fixed.current.translation());

      // @ts-ignore - meshline types are not properly defined
      band.current.geometry.setPoints(curve.getPoints(32));
    }

    if (card.current) {
      ang.copy(card.current.angvel());
      rot.copy(card.current.rotation());
      card.current.setAngvel({ x: ang.x, y: ang.y - rot.y * 0.25, z: ang.z });
    }
  });

  return (
    <>
      <group position={[0, 4, 0]}>
        <RigidBody ref={fixed} type="fixed" />
        <RigidBody position={[0.5, 0, 0]} ref={j1}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1, 0, 0]} ref={j2}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1.5, 0, 0]} ref={j3}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody 
          position={[2, 0, 0]} 
          ref={card} 
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
              font="/fonts/inter-bold.woff"
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