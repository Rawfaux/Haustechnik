'use client'

import { useState } from 'react'

export default function PhotoViewer({ photos, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0)

  if (!photos || photos.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded p-6 max-w-md">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Keine Fotos</h3>
          <p className="text-gray-600 mb-4">Zu dieser Fahrt wurden keine Fotos hochgeladen.</p>
          <button
            onClick={onClose}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded font-semibold"
          >
            Schließen
          </button>
        </div>
      </div>
    )
  }

  const currentPhoto = photos[currentIndex]

  const goToPrevious = () => {
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : photos.length - 1))
  }

  const goToNext = () => {
    setCurrentIndex(prev => (prev < photos.length - 1 ? prev + 1 : 0))
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 p-4">
      <div className="relative w-full h-full flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 text-white">
          <h3 className="text-xl font-bold">
            Foto {currentIndex + 1} von {photos.length}
          </h3>
          <button
            onClick={onClose}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded font-semibold"
          >
            ✕ Schließen
          </button>
        </div>

        {/* Main Image */}
        <div className="flex-1 flex items-center justify-center relative">
          {photos.length > 1 && (
            <>
              <button
                onClick={goToPrevious}
                className="absolute left-4 bg-white bg-opacity-80 hover:bg-opacity-100 text-gray-900 w-12 h-12 rounded-full font-bold text-2xl"
              >
                ‹
              </button>
              <button
                onClick={goToNext}
                className="absolute right-4 bg-white bg-opacity-80 hover:bg-opacity-100 text-gray-900 w-12 h-12 rounded-full font-bold text-2xl"
              >
                ›
              </button>
            </>
          )}

          <img
            src={currentPhoto.photo_data}
            alt={`Foto ${currentIndex + 1}`}
            className="max-w-full max-h-full object-contain"
          />
        </div>

        {/* Thumbnails */}
        {photos.length > 1 && (
          <div className="flex gap-2 justify-center p-4 overflow-x-auto">
            {photos.map((photo, index) => (
              <button
                key={photo.id}
                onClick={() => setCurrentIndex(index)}
                className={`flex-shrink-0 ${
                  index === currentIndex
                    ? 'border-4 border-blue-500'
                    : 'border-2 border-gray-400 opacity-60 hover:opacity-100'
                }`}
              >
                <img
                  src={photo.photo_data}
                  alt={`Thumbnail ${index + 1}`}
                  className="w-20 h-20 object-cover"
                />
              </button>
            ))}
          </div>
        )}

        {/* Info */}
        <div className="text-center text-white p-2 text-sm">
          <p>
            Hochgeladen: {new Date(currentPhoto.uploaded_at).toLocaleString('de-DE')}
          </p>
        </div>
      </div>
    </div>
  )
}