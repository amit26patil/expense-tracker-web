import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { OAuthService, AuthConfig } from 'angular-oauth2-oidc';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private authConfig!: AuthConfig;

  constructor(
    private oauthService: OAuthService,
    private router: Router,
    private http: HttpClient,
  ) {}

  private async loadConfig(): Promise<void> {
    const config = await firstValueFrom(
      this.http.get<OAuthConfig>(`${environment.apiUrl}/auth/config`),
    );
    this.authConfig = {
      issuer: environment.auth.issuer,
      redirectUri: environment.auth.redirectUri,
      clientId: config.clientId,
      dummyClientSecret: config.clientSecret,
      scope: environment.auth.scope,
      responseType: environment.auth.responseType,
      silentRefreshRedirectUri: environment.auth.silentRefreshRedirectUri,
      useSilentRefresh: environment.auth.useSilentRefresh,
      sessionChecksEnabled: environment.auth.sessionChecksEnabled,
      showDebugInformation: environment.auth.showDebugInformation,
      strictDiscoveryDocumentValidation: false,
      oidc: false,
      disablePKCE: true,
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      userinfoEndpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
      revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
      loginUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    };
    this.oauthService.configure(this.authConfig);
  }

  async initAuth(): Promise<boolean> {
    await this.loadConfig();
    if (this.oauthService.hasValidAccessToken()) {
      this.oauthService.setupAutomaticSilentRefresh();
      return true;
    }
    else {
      await this.oauthService.tryLogin();
    }
    return false;
  }

  login(): void {
    this.oauthService.initLoginFlow();
  }

  logout(): void {
    this.oauthService.logOut();
    this.router.navigate(['/']);
  }

  getAccessToken(): string {
    return this.oauthService.getAccessToken();
  }

  getIdClaims(): any {
    return this.oauthService.getIdentityClaims();
  }

  isLoggedIn(): boolean {
    return this.oauthService.hasValidAccessToken();
  }
}
