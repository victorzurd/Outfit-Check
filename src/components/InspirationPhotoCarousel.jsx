import { useRef, useState } from 'react'
import { Shirt } from 'lucide-react'

export default function InspirationPhotoCarousel({ items }) {
  const trackRef = useRef(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const total = items.length
  const handleScroll = () => {
    const track = trackRef.current
    if (!track) return
    const slideWidth = track.firstElementChild?.getBoundingClientRect().width || track.clientWidth
    const nextIndex = Math.max(0, Math.min(total - 1, Math.round(track.scrollLeft / Math.max(slideWidth, 1))))
    setActiveIndex(current => current === nextIndex ? current : nextIndex)
  }

  return <div className="inspiration-photo-carousel" aria-label={`${total} fotos del outfit`}>
    <div className="inspiration-photo-track" ref={trackRef} onScroll={handleScroll}>
      {items.map(item => <div className="inspiration-photo" key={item.id}>
        {item.image ? <img src={item.image} alt={item.name}/> : <Shirt size={36}/>}
        <span>{item.name}</span>
      </div>)}
    </div>
    <div className="photo-pagination" aria-label={`Foto ${activeIndex + 1} de ${total}`} aria-live="polite">
      <span className="photo-current">{String(activeIndex + 1).padStart(2, '0')}</span>
      <span className="photo-divider">/</span>
      <span className="photo-total">{String(total).padStart(2, '0')}</span>
      <span className="photo-progress" aria-hidden="true">{items.map((item, index) => <i key={item.id} className={index === activeIndex ? 'active' : ''}/>)}</span>
    </div>
  </div>
}


