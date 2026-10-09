import { supabase } from './supabase.js'

export const imageStoragePath = value => {
  if (!value || !value.startsWith('http')) return value || ''
  try {
    const path = new URL(value).pathname
    const marker = '/storage/v1/object/public/wardrobe-photos/'
    const signedMarker = '/storage/v1/object/sign/wardrobe-photos/'
    if (path.includes(marker)) return decodeURIComponent(path.split(marker)[1])
    if (path.includes(signedMarker)) return decodeURIComponent(path.split(signedMarker)[1])
  } catch {}
  return value
}
export const mapWardrobeRow = async row => {
  const imagePath = imageStoragePath(row.image_url)
  let image = imagePath
  if (imagePath && !imagePath.startsWith('data:') && !imagePath.startsWith('blob:') && !imagePath.startsWith('http')) {
    const { data } = await supabase.storage.from('wardrobe-photos').createSignedUrl(imagePath, 60 * 60 * 24)
    image = data?.signedUrl || ''
  }
  return {
    id: row.id, name: row.name, category: row.category, subcategory: row.subcategory || '',
    description: row.description || '', aiAttributes: row.ai_attributes || {}, color: row.color || '',
    brand: row.brand || '', image, imagePath, createdAt: row.created_at,
  }
}
