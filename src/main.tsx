import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from './contexts/AuthContext'
import { SpaceProvider } from './contexts/SpaceContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <SpaceProvider>
      <App />
    </SpaceProvider>
  </AuthProvider>
)
