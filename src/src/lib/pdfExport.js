import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Einzelne Fahrt als PDF exportieren
export const exportTripToPDF = async (trip, photos = []) => {
  const doc = new jsPDF()
  
  // Header
  doc.setFontSize(20)
  doc.setFont(undefined, 'bold')
  doc.text('Fahrtenprotokoll', 105, 20, { align: 'center' })
  
  doc.setFontSize(10)
  doc.setFont(undefined, 'normal')
  doc.text(`Erstellt am: ${new Date().toLocaleDateString('de-DE')}`, 105, 28, { align: 'center' })
  
  // Linie
  doc.setLineWidth(0.5)
  doc.line(20, 32, 190, 32)
  
  let yPos = 40
  
  // Fahrtdaten
  doc.setFontSize(14)
  doc.setFont(undefined, 'bold')
  doc.text('Fahrtdaten', 20, yPos)
  yPos += 8
  
  doc.setFontSize(10)
  doc.setFont(undefined, 'normal')
  
  const fahrtDaten = [
    ['Datum', new Date(trip.created_at).toLocaleDateString('de-DE')],
    ['Start-Zeit', new Date(trip.start_time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr'],
    ['End-Zeit', trip.end_time ? new Date(trip.end_time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr' : '-'],
    ['', ''],
    ['Start-Ort', trip.start_location || '-'],
    ['Start-KM', trip.start_km ? `${trip.start_km.toFixed(1)} km` : 'Erste Fahrt'],
    ['', ''],
    ['End-Ort', trip.end_location || '-'],
    ['End-KM', trip.end_km ? `${trip.end_km.toFixed(1)} km` : '-'],
    ['Gefahrene KM', trip.end_km && trip.start_km ? `${(trip.end_km - trip.start_km).toFixed(1)} km` : '-'],
    ['', ''],
    ['Zweck', trip.purpose === 'geschaeftlich' ? 'Geschäftlich' : 'Privat'],
    ['Status', trip.status === 'COMPLETED' ? 'Abgeschlossen' : 'In Bearbeitung'],
  ]
  
    autoTable(doc, {
    startY: yPos,
    head: [],
    body: fahrtDaten,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 40 },
      1: { cellWidth: 130 }
    }
  })
  
  yPos = doc.lastAutoTable.finalY + 10
  
  // Änderungsgrund
  if (trip.change_reason) {
    doc.setFontSize(14)
    doc.setFont(undefined, 'bold')
    doc.text('Änderungsgrund', 20, yPos)
    yPos += 8
    
    doc.setFontSize(10)
    doc.setFont(undefined, 'normal')
    const splitReason = doc.splitTextToSize(trip.change_reason, 170)
    doc.text(splitReason, 20, yPos)
    yPos += (splitReason.length * 5) + 10
  }
  
  // Unterschrift
  if (trip.signature_data) {
    // Neue Seite wenn nötig
    if (yPos > 240) {
      doc.addPage()
      yPos = 20
    }
    
    doc.setFontSize(14)
    doc.setFont(undefined, 'bold')
    doc.text('Unterschrift', 20, yPos)
    yPos += 8
    
    try {
      doc.addImage(trip.signature_data, 'PNG', 20, yPos, 80, 30)
      yPos += 35
      
      doc.setFontSize(8)
      doc.setFont(undefined, 'italic')
      doc.text(`Signiert am: ${new Date(trip.signature_date).toLocaleString('de-DE')}`, 20, yPos)
      yPos += 10
    } catch (error) {
      console.error('Fehler beim Hinzufügen der Unterschrift:', error)
    }
  }
  
  // Fotos
  if (photos && photos.length > 0) {
    // Neue Seite für Fotos
    doc.addPage()
    yPos = 20
    
    doc.setFontSize(14)
    doc.setFont(undefined, 'bold')
    doc.text(`Fotos (${photos.length})`, 20, yPos)
    yPos += 10
    
    const imgWidth = 80
    const imgHeight = 60
    const margin = 10
    let xPos = 20
    
    for (let i = 0; i < photos.length; i++) {
      try {
        // Neue Zeile nach 2 Bildern
        if (i > 0 && i % 2 === 0) {
          xPos = 20
          yPos += imgHeight + margin
          
          // Neue Seite wenn nötig
          if (yPos + imgHeight > 280) {
            doc.addPage()
            yPos = 20
          }
        }
        
        doc.addImage(photos[i].photo_data, 'JPEG', xPos, yPos, imgWidth, imgHeight)
        
        doc.setFontSize(8)
        doc.text(`Foto ${i + 1}`, xPos, yPos + imgHeight + 5)
        
        xPos += imgWidth + margin
      } catch (error) {
        console.error(`Fehler beim Hinzufügen von Foto ${i + 1}:`, error)
      }
    }
  }
  
  // Footer auf jeder Seite
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setFont(undefined, 'italic')
    doc.text(
      `Seite ${i} von ${pageCount}`,
      105,
      290,
      { align: 'center' }
    )
  }
  
  // PDF speichern
  const filename = `Fahrt_${new Date(trip.created_at).toLocaleDateString('de-DE').replace(/\./g, '-')}_${trip.start_location}.pdf`
  doc.save(filename)
}

// Alle Fahrten als PDF exportieren
export const exportAllTripsToPDF = (trips) => {
  const doc = new jsPDF()
  
  // Header
  doc.setFontSize(20)
  doc.setFont(undefined, 'bold')
  doc.text('Fahrtenbuch - Alle Fahrten', 105, 20, { align: 'center' })
  
  doc.setFontSize(10)
  doc.setFont(undefined, 'normal')
  doc.text(`Erstellt am: ${new Date().toLocaleDateString('de-DE')}`, 105, 28, { align: 'center' })
  doc.text(`Anzahl Fahrten: ${trips.length}`, 105, 34, { align: 'center' })
  
  // Statistiken berechnen
  const geschaeftlich = trips.filter(t => t.purpose === 'geschaeftlich').length
  const privat = trips.filter(t => t.purpose === 'privat').length
  
  const gesamtKm = trips.reduce((sum, trip) => {
    if (trip.end_km && trip.start_km) {
      return sum + (trip.end_km - trip.start_km)
    }
    return sum
  }, 0)
  
  const geschaeftlichKm = trips
    .filter(t => t.purpose === 'geschaeftlich')
    .reduce((sum, trip) => {
      if (trip.end_km && trip.start_km) {
        return sum + (trip.end_km - trip.start_km)
      }
      return sum
    }, 0)
  
  const privatKm = trips
    .filter(t => t.purpose === 'privat')
    .reduce((sum, trip) => {
      if (trip.end_km && trip.start_km) {
        return sum + (trip.end_km - trip.start_km)
      }
      return sum
    }, 0)
  
  // Statistik-Box
  doc.setLineWidth(0.5)
  doc.rect(20, 40, 170, 25)
  
  doc.setFontSize(10)
  doc.setFont(undefined, 'bold')
  doc.text('Statistik:', 25, 47)
  
  doc.setFont(undefined, 'normal')
  doc.text(`Gesamt: ${gesamtKm.toFixed(1)} km`, 25, 53)
  doc.text(`Geschäftlich: ${geschaeftlich} Fahrten (${geschaeftlichKm.toFixed(1)} km)`, 25, 58)
  doc.text(`Privat: ${privat} Fahrten (${privatKm.toFixed(1)} km)`, 25, 63)
  
  // Tabelle
  const tableData = trips.map(trip => [
    new Date(trip.created_at).toLocaleDateString('de-DE'),
    trip.start_location || '-',
    trip.end_location || '-',
    trip.start_km ? `${trip.start_km.toFixed(1)}` : '-',
    trip.end_km ? `${trip.end_km.toFixed(1)}` : '-',
    (trip.end_km && trip.start_km) ? `${(trip.end_km - trip.start_km).toFixed(1)}` : '-',
    trip.purpose === 'geschaeftlich' ? 'Geschäftlich' : 'Privat',
    trip.status === 'COMPLETED' ? 'Abgeschlossen' : 'Läuft'
  ])
  
    autoTable(doc, {
    startY: 72,
    head: [['Datum', 'Von', 'Nach', 'Start-KM', 'End-KM', 'Gefahren', 'Zweck', 'Status']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [66, 139, 202], fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 30 },
      2: { cellWidth: 30 },
      3: { cellWidth: 18 },
      4: { cellWidth: 18 },
      5: { cellWidth: 18 },
      6: { cellWidth: 25 },
      7: { cellWidth: 21 }
    }
  })
  
  // Footer
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setFont(undefined, 'italic')
    doc.text(
      `Seite ${i} von ${pageCount}`,
      105,
      290,
      { align: 'center' }
    )
  }
  
  // PDF speichern
  const filename = `Fahrtenbuch_Alle_${new Date().toLocaleDateString('de-DE').replace(/\./g, '-')}.pdf`
  doc.save(filename)
}