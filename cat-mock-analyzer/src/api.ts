/** Thin wrapper around the /api endpoints */

const BASE = '/api';

async function request<T>(
  method: string,
  url: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(BASE + url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  getMocks: () => request<any[]>('GET', '/mocks'),
  getMock: (id: string) => request<any>('GET', `/mocks/${id}`),
  createMock: (payload: unknown) => request<{ id: string }>('POST', '/mocks', payload),
  updateMock: (id: string, payload: unknown) =>
    request<{ ok: boolean }>('PUT', `/mocks/${id}`, payload),
  deleteMock: (id: string) => request<{ ok: boolean }>('DELETE', `/mocks/${id}`),
  getSettings: () => request<Record<string, unknown>>('GET', '/settings'),
  updateSettings: (payload: Record<string, unknown>) =>
    request<{ ok: boolean }>('PUT', '/settings', payload),
  exportMocks: () => fetch(BASE + '/export').then((r) => r.blob()),
  importMocks: (payload: unknown) => request<{ imported: number }>('POST', '/import', payload),
};
