import {Injectable} from '@angular/core';
import {BehaviorSubject, from, Observable} from 'rxjs';

import {MOCK_AIRCRAFT_DATA} from './mock-aircraft-data';
import {Aircraft} from '../../interfaces/aircraft';

@Injectable({
  providedIn: 'root'
})
export class ManageAircraftService {

  private aircraft$ = new BehaviorSubject<Aircraft[]>(MOCK_AIRCRAFT_DATA);

  private getSizeClassOptions = () => Promise.resolve({sizeClasses: [...new Set(MOCK_AIRCRAFT_DATA.map(a => a.sizeClass))].filter(s => !!s).sort()});
  private getOemOptions = () => Promise.resolve({oem: [...new Set(MOCK_AIRCRAFT_DATA.map(a => a.oem))].filter(s => !!s).sort()});

  public sizeClassOptions$ = from(this.getSizeClassOptions());
  public oemOptions$ = from(this.getOemOptions());

  getAircraft(): Observable<Aircraft[]> {
    /* Combined with the OPTIONS to get all data & component assets from the BE. */
    return this.aircraft$.asObservable();
  }

  addAircraft(aircraft: Aircraft): void {
    const current = this.aircraft$.value;
    // Ensure new items get a unique ID higher than the mock data IDs
    const nextId = current.length > 0 ? Math.max(...current.map(a => a.id)) + 1 : 1;
    this.aircraft$.next([...current, { ...aircraft, id: nextId }]);
  }

  updateAircraft(updated: Aircraft): void {
    const current = this.aircraft$.value;
    const index = current.findIndex(a => a.id === updated.id);
    if (index > -1) {
      current[index] = updated;
      this.aircraft$.next([...current]);
    }
  }

  deleteAircraft(id: number): void {
    const filtered = this.aircraft$.value.filter(a => a.id !== id);
    this.aircraft$.next(filtered);
  }
}