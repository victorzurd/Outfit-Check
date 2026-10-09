export const MAX_PHOTO_SIZE = 10 * 1024 * 1024
const TARGET_PHOTO_SIZE = 400 * 1024
export const toOptimizedPhoto = file => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => {
    const image = new Image()
    image.onerror = () => reject(new Error('El archivo no parece ser una imagen válida.'))
    image.onload = () => {
      const edgeSizes = [1400, 1200, 1000, 800]
      const qualities = [0.78, 0.68, 0.58]
      const encode = (edgeIndex, qualityIndex) => {
        const maxEdge = edgeSizes[edgeIndex]
        const scale = Math.min(1, maxEdge / Math.max(image.width, image.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.width * scale))
        canvas.height = Math.max(1, Math.round(image.height * scale))
        const context = canvas.getContext('2d')
        if (!context) { reject(new Error('No se pudo procesar la imagen en este dispositivo.')); return }
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(blob => {
          if (!blob) { reject(new Error('No se pudo procesar la imagen en este dispositivo.')); return }
          if (blob.size <= TARGET_PHOTO_SIZE || (edgeIndex === edgeSizes.length - 1 && qualityIndex === qualities.length - 1)) {
            resolve(blob)
            return
          }
          if (qualityIndex < qualities.length - 1) encode(edgeIndex, qualityIndex + 1)
          else encode(Math.min(edgeIndex + 1, edgeSizes.length - 1), 0)
        }, 'image/jpeg', qualities[qualityIndex])
      }
      encode(0, 0)
    }
    image.src = reader.result
  }
  reader.onerror = () => reject(new Error('No se pudo leer la imagen.'))
  reader.readAsDataURL(file)
})
export const toDataUrl = blob => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = () => reject(new Error('No se pudo preparar la imagen para guardarla en este dispositivo.'))
  reader.readAsDataURL(blob)
})
