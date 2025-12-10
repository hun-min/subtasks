import { Canvas } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import HexagonGrid from './HexagonGrid'

export default function Background3D() {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 0, opacity: 1.0, pointerEvents: 'none' }}>
      <Canvas camera={{ position: [0, 50, 40], fov: 30 }} dpr={[1, 2]}>
        <color attach="background" args={['#02020a']} />
        <ambientLight intensity={0.3} />
        <pointLight 
          position={[10, 20, 10]} 
          intensity={300} 
          color="#0088ff" 
          distance={50} 
          decay={2}
        />
        <pointLight position={[-10, 10, -10]} intensity={150} color="#00aaff" />
        <group position={[0, -20, 0]}>
          <HexagonGrid />
        </group>
        <EffectComposer enableNormalPass={false}>
          <Bloom 
            luminanceThreshold={0.1}
            mipmapBlur
            intensity={1.0}
            radius={0.3}
          />
        </EffectComposer>
      </Canvas>
    </div>
  )
}
