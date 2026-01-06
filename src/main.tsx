import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from './contexts/AuthContext'
import { SpaceProvider } from './contexts/SpaceContext'
import { registerSW } from 'virtual:pwa-register'

if (import.meta.env.PROD) {
  registerSW({ immediate: true })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <SpaceProvider>
      <App />
    </SpaceProvider>
  </AuthProvider>
)
