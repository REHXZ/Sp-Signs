import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {AboutComponent} from './about/about.component';
import {LanguagesComponent} from './languages/languages.component';
import {ContributeComponent} from './contribute/contribute.component';
import {ToolsComponent} from './tools/tools.component';
import {LandingComponent} from './landing.component';
import {LicensesComponent} from './licenses/licenses.component';
import {BusinessComponent} from './business/business.component';
import {TermsComponent} from './terms/terms.component';
import {PrivacyComponent} from './privacy/privacy.component';

const routes: Routes = [
  {
    path: '',
    component: LandingComponent,
    children: [
      {path: '', component: AboutComponent},
      {path: 'about', redirectTo: ''},
      {path: 'business', component: BusinessComponent},
      {path: 'languages', component: LanguagesComponent},
      {path: 'contribute', component: ContributeComponent},
      {path: 'tools', component: ToolsComponent},
      {path: 'terms', component: TermsComponent},
      {path: 'privacy', component: PrivacyComponent},
      {path: 'licenses', component: LicensesComponent},
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class LandingRoutingModule {}
