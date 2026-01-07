import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from './contexts/AuthContext'
import { SpaceProvider } from './contexts/SpaceContext'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <SpaceProvider>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </SpaceProvider>
  </AuthProvider>
)
