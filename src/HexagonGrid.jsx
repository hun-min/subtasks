import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function HexagonGrid({ count = 30, audioData = null }) {
  const meshRef = useRef()
  const tempObject = useMemo(() => new THREE.Object3D(), [])
  
  const hexagons = useMemo(() => {
    const positions = []
    const spacing = 0.7
    
    for (let x = 0; x < count; x++) {
      for (let z = 0; z < count; z++) {
        const offsetX = (z % 2) * spacing * 0.5
        positions.push({
          x: x * spacing - (count * spacing) / 2 + offsetX,
          z: z * spacing * 0.866 - (count * spacing * 0.866) / 2,
          index: x * count + z
        })
      }
    }
    return positions
  }, [count])

  useFrame((state) => {
    if (!meshRef.current) return
    
    const time = state.clock.getElapsedTime()
    
    hexagons.forEach(({ x, z, index }) => {
      const distance = Math.sqrt(x * x + z * z)
      const wave = Math.sin(distance * 0.3 - time * 0.2) * 0.5
      const audioBoost = audioData ? audioData[index % audioData.length] * 2 : 0
      
      tempObject.position.set(x, wave + audioBoost, z)
      tempObject.rotation.set(time * 0.2, time * 0.3, 0)
      tempObject.scale.setScalar(0.5 + Math.abs(wave) * 0.3)
      tempObject.updateMatrix()
      
      meshRef.current.setMatrixAt(index, tempObject.matrix)
    })
    
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[null, null, hexagons.length]}>
      <cylinderGeometry args={[0.25, 0.25, 0.5, 6]} />
      <meshStandardMaterial 
        color="#000000" 
        emissive="#0088ff" 
        emissiveIntensity={1.5}
        roughness={0.2}
        metalness={1.0}
        toneMapped={false}
        flatShading={true}
      />
    </instancedMesh>
  )
}
