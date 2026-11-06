import { create } from 'zustand'
import { loadCareer } from './db'

/** Stato della carriera attiva: carica e ricarica i dati dal database locale. */
export const useCareer = create((set) => ({
  career: null,
  clubs: [],
  players: [],
  fixtures: [],

  async load(careerId) {
    const data = await loadCareer(careerId)
    set(data)
  },

  async refresh() {
    const { career, load } = useCareer.getState()
    if (career) await load(career.id)
  },

  clear() {
    set({ career: null, clubs: [], players: [], fixtures: [] })
  },
}))
