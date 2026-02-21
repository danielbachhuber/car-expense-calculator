import { useState, useEffect, useCallback } from 'react';
import type { Car, Household, AppData } from './types';

const IS_DEV = import.meta.env.DEV;
const STORAGE_KEY = 'car-expense-calculator-data';

const DEFAULT_HOUSEHOLD: Household = { monthlySavings: 0, totalSaved: 0 };

// --- localStorage helpers ---

function loadFromStorage(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AppData) : { household: DEFAULT_HOUSEHOLD, cars: [] };
  } catch {
    return { household: DEFAULT_HOUSEHOLD, cars: [] };
  }
}

function saveToStorage(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// --- API helpers (dev only) ---

async function loadFromApi(): Promise<AppData> {
  const res = await fetch('/api/cars');
  return res.json();
}

async function saveToApi(data: AppData): Promise<void> {
  await fetch('/api/cars', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

function persist(data: AppData): void {
  if (IS_DEV) {
    saveToApi(data);
  } else {
    saveToStorage(data);
  }
}

function generateId(): string {
  return `car-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useAppData() {
  const [data, setData] = useState<AppData>({ household: DEFAULT_HOUSEHOLD, cars: [] });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (IS_DEV) {
      loadFromApi().then(d => {
        setData(d);
        setLoaded(true);
      });
    } else {
      setData(loadFromStorage());
      setLoaded(true);
    }
  }, []);

  const updateHousehold = useCallback((household: Household) => {
    setData(prev => {
      const next = { ...prev, household };
      persist(next);
      return next;
    });
  }, []);

  const addCar = useCallback((car: Omit<Car, 'id'>) => {
    setData(prev => {
      const next = { ...prev, cars: [...prev.cars, { ...car, id: generateId() }] };
      persist(next);
      return next;
    });
  }, []);

  const updateCar = useCallback((updated: Car) => {
    setData(prev => {
      const next = { ...prev, cars: prev.cars.map(c => (c.id === updated.id ? updated : c)) };
      persist(next);
      return next;
    });
  }, []);

  const deleteCar = useCallback((id: string) => {
    setData(prev => {
      const next = { ...prev, cars: prev.cars.filter(c => c.id !== id) };
      persist(next);
      return next;
    });
  }, []);

  return {
    household: data.household,
    cars: data.cars,
    loaded,
    updateHousehold,
    addCar,
    updateCar,
    deleteCar,
  };
}
