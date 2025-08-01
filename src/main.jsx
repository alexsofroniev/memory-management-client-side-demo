import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './App.css'
import MemoryManagementDemo from './MemoryManagementDemo.jsx'

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <MemoryManagementDemo />
    </StrictMode>,
)
