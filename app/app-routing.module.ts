import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {ManageAircraftComponent} from "./core/components/manage-aircraft/manage-aircraft.component";

const routes: Routes = [
  { path: '', redirectTo: 'manage-aircraft', pathMatch: 'full' },
  { path: 'manage-aircraft', component: ManageAircraftComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
