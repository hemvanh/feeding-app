import { petSex, petSexLabel, type PetSex } from '../types'

export function SexIcon({ sex }: { sex: PetSex | undefined }) {
  const value = petSex(sex)
  return (
    <svg className={`pet-sex-icon ${value}`} viewBox="0 0 24 24" aria-label={petSexLabel(value)} role="img">
      {value === 'male' ? (
        <>
          <circle cx="9.5" cy="14.5" r="5.2" fill="none" stroke="currentColor" strokeWidth="2.2" />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13.5 10.5 20 4M14.2 4H20v5.8"
          />
        </>
      ) : value === 'female' ? (
        <>
          <circle cx="12" cy="9" r="5.2" fill="none" stroke="currentColor" strokeWidth="2.2" />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            d="M12 14.2v6.3M8.6 17.8h6.8"
          />
        </>
      ) : (
        <>
          <circle cx="10.2" cy="11.2" r="4.3" fill="none" stroke="currentColor" strokeWidth="2.1" />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13.6 7.8 19.2 2.2M13.9 2.2H19.2V7.5M10.2 15.5v5.3M7.4 18.4h5.6"
          />
        </>
      )}
    </svg>
  )
}
