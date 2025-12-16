'use client'

import { useRef, useState, useEffect } from 'react'

export default function SignatureCanvas({ onSave, onCancel }) {
  const canvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [isEmpty, setIsEmpty] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  const startDrawing = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const ctx = canvas.getContext('2d')

    const x = e.clientX ? e.clientX - rect.left : e.touches[0].clientX - rect.left
    const y = e.clientY ? e.clientY - rect.top : e.touches[0].clientY - rect.top

    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
    setIsEmpty(false)
  }

  const draw = (e) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const ctx = canvas.getContext('2d')

    const x = e.clientX ? e.clientX - rect.left : e.touches[0].clientX - rect.left
    const y = e.clientY ? e.clientY - rect.top : e.touches[0].clientY - rect.top

    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setIsEmpty(true)
  }

  const saveSignature = () => {
    if (isEmpty) {
      alert('Bitte unterschreiben Sie zuerst')
      return
    }

    const canvas = canvasRef.current
    const dataURL = canvas.toDataURL('image/png')
    onSave(dataURL)
  }

  return (
    <div className="bg-white border-2 border-gray-300 rounded p-4">
      <h3 className="text-lg font-bold text-gray-900 mb-4">✍️ Unterschrift erforderlich</h3>
      
      <div className="mb-4">
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="border-2 border-gray-400 rounded cursor-crosshair bg-gray-50 w-full"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={clearCanvas}
          className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded font-semibold"
        >
          🗑️ Löschen
        </button>
        <button
          type="button"
          onClick={saveSignature}
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded font-semibold flex-1"
        >
          ✓ Unterschrift bestätigen
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded font-semibold"
        >
          Abbrechen
        </button>
      </div>

      <p className="text-sm text-gray-600 mt-4">
        ℹ️ Bitte unterschreiben Sie mit der Maus oder dem Finger (Touchscreen)
      </p>
    </div>
  )
}