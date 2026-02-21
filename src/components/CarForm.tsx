import { useState, useEffect } from 'react';
import type { Car } from '../types';

interface CarFormProps {
  initial?: Car | null;
  onSave: (car: Omit<Car, 'id'> & { id?: string }) => void;
  onCancel: () => void;
}

const CURRENT_YEAR = new Date().getFullYear();

function emptyForm() {
  return {
    name: '',
    currentValue: '',
    replacementCost: '',
    replacementYear: String(CURRENT_YEAR + 5),
    currentSavings: '0',
    estimatedResaleValue: '',
  };
}

export function CarForm({ initial, onSave, onCancel }: CarFormProps) {
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name,
        currentValue: String(initial.currentValue),
        replacementCost: String(initial.replacementCost),
        replacementYear: String(initial.replacementYear),
        currentSavings: String(initial.currentSavings),
        estimatedResaleValue: initial.estimatedResaleValue != null ? String(initial.estimatedResaleValue) : '',
      });
    } else {
      setForm(emptyForm());
    }
  }, [initial]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      id: initial?.id,
      name: form.name.trim(),
      currentValue: Number(form.currentValue) || 0,
      replacementCost: Number(form.replacementCost) || 0,
      replacementYear: Number(form.replacementYear) || CURRENT_YEAR + 5,
      currentSavings: Number(form.currentSavings) || 0,
      estimatedResaleValue: form.estimatedResaleValue !== '' ? Number(form.estimatedResaleValue) : undefined,
      estimatedResaleYear: form.estimatedResaleValue !== '' ? (Number(form.replacementYear) || CURRENT_YEAR + 5) : undefined,
    });
  }

  function field(label: string, key: keyof typeof form, type = 'text', extra?: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <input
          type={type}
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          className="rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
          {...extra}
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {field('Car name', 'name', 'text', { placeholder: 'e.g. 2018 Honda CR-V', required: true })}
      {field('Current value ($)', 'currentValue', 'number', { placeholder: '25000', min: '0' })}
      {field('Expected replacement cost ($)', 'replacementCost', 'number', { placeholder: '35000', min: '0', required: true })}
      {field('Replacement year', 'replacementYear', 'number', { placeholder: String(CURRENT_YEAR + 5), min: String(CURRENT_YEAR), required: true })}
      {field('Current savings toward this car ($)', 'currentSavings', 'number', { placeholder: '0', min: '0' })}
      {field('Estimated trade-in / resale value at replacement ($)', 'estimatedResaleValue', 'number', { placeholder: '0', min: '0' })}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="flex-1 rounded-lg bg-blue-600 text-white font-medium py-2 hover:bg-blue-700 transition"
        >
          {initial ? 'Save changes' : 'Add car'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-slate-300 text-slate-600 font-medium py-2 hover:bg-slate-50 transition"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
