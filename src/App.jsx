import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Home } from './pages/Home'
import { Sala } from './pages/Sala'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/sala/:id" element={<Sala />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
