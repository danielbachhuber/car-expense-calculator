import { useState, useEffect, useCallback } from 'react';
import type { Car } from './types';

const IS_DEV = import.meta.env.DEV;
const STORAGE_KEY = 'car-expense-calculator-cars';

// --- localStorage helpers ---

function loadFromStorage(): Car[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Car[]) : [];
  } catch {
    return [];
  }
}

function saveToStorage(cars: Car[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cars));
}

// --- API helpers (dev only) ---

async function loadFromApi(): Promise<Car[]> {
  const res = await fetch('/api/cars');
  return res.json();
}

async function saveToApi(cars: Car[]): Promise<void> {
  await fetch('/api/cars', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cars),
  });
}

// --- shared ---

function persist(cars: Car[]): void {
  if (IS_DEV) {
    saveToApi(cars);
  } else {
    saveToStorage(cars);
  }
}

function generateId(): string {
  return `car-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useCars() {
  const [cars, setCars] = useState<Car[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (IS_DEV) {
      loadFromApi().then(data => {
        setCars(data);
        setLoaded(true);
      });
    } else {
      setCars(loadFromStorage());
      setLoaded(true);
    }
  }, []);

  const addCar = useCallback((data: Omit<Car, 'id'>) => {
    setCars(prev => {
      const next = [...prev, { ...data, id: generateId() }];
      persist(next);
      return next;
    });
  }, []);

  const updateCar = useCallback((updated: Car) => {
    setCars(prev => {
      const next = prev.map(c => (c.id === updated.id ? updated : c));
      persist(next);
      return next;
    });
  }, []);

  const deleteCar = useCallback((id: string) => {
    setCars(prev => {
      const next = prev.filter(c => c.id !== id);
      persist(next);
      return next;
    });
  }, []);

  return { cars, loaded, addCar, updateCar, deleteCar };
}
