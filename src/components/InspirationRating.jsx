import { Star } from 'lucide-react'

export default function InspirationRating({ card, onRate, className = '' }) {
  return <div className={`inspiration-rating ${className}`} aria-label="Puntúa este outfit">
    <span className="rating-caption">¿Te lo pondrías?</span>
    {[5, 4, 3, 2, 1].map(score => <button key={score} className={card.rating >= score ? 'rated' : ''}
      title={`${score} de 5`} aria-label={`Puntuar con ${score} de 5`} onClick={() => onRate(card, score)}>
      <Star size={20} fill={card.rating >= score ? 'currentColor' : 'none'}/><small>{score}</small>
    </button>)}
  </div>
}
