'use client'

import { useState } from 'react'

export default function PhotoUpload({ onUpload, maxPhotos = 5 }) {
  const [photos, setPhotos] = useState([])
  const [previews, setPreviews] = useState([])
  const [uploading, setUploading] = useState(false)

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)

    if (photos.length + files.length > maxPhotos) {
      alert(`Maximal ${maxPhotos} Fotos erlaubt`)
      return
    }

    // Fotos validieren
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        alert(`${file.name} ist kein Bild`)
        return false
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB Limit
        alert(`${file.name} ist zu groß (max 5MB)`)
        return false
      }
      return true
    })

    // Base64 konvertieren
    validFiles.forEach(file => {
      const reader = new FileReader()
      reader.onload = (event) => {
        const base64 = event.target.result
        setPhotos(prev => [...prev, base64])
        setPreviews(prev => [...prev, { name: file.name, data: base64 }])
      }
      reader.readAsDataURL(file)
    })
  }

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index))
    setPreviews(prev => prev.filter((_, i) => i !== index))
  }


const handleUpload = () => {
  if (photos.length === 0) {
    alert('Bitte wählen Sie mindestens ein Foto aus')
    return
  }

  if (uploading) return

  setUploading(true)
  onUpload(photos)
  
  // Nach 2 Sekunden zurücksetzen (falls Parent nicht resettet)
  setTimeout(() => {
    setUploading(false)
    setPhotos([])
    setPreviews([])
  }, 2000)
}

  return (
    <div className="bg-white border-2 border-gray-300 rounded p-4">
      <h3 className="text-lg font-bold text-gray-900 mb-4">📸 Fotos hochladen</h3>

      {/* File Input */}
      <div className="mb-4">
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="w-full px-4 py-2 border border-gray-300 rounded text-gray-900 bg-white"
          disabled={photos.length >= maxPhotos}
        />
        <p className="text-sm text-gray-600 mt-2">
          {photos.length} / {maxPhotos} Fotos ausgewählt (max 5MB pro Foto)
        </p>
      </div>

      {/* Previews */}
      {previews.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          {previews.map((preview, index) => (
            <div key={index} className="relative">
              <img
                src={preview.data}
                alt={preview.name}
                className="w-full h-32 object-cover rounded border-2 border-gray-300"
              />
              <button
                type="button"
                onClick={() => removePhoto(index)}
                className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload Button */}
      <button
        type="button"
        onClick={handleUpload}
        disabled={photos.length === 0 || uploading}
        className="w-full bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploading ? '⏳ Lädt...' : `✓ ${photos.length} Foto${photos.length !== 1 ? 's' : ''} hochladen`}
      </button>
    </div>
  )
}