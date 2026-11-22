import { Component, computed, inject } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { call, cameraReverse, mic, micOff, person, videocam, videocamOff } from 'ionicons/icons';
import { COMM_TEXT } from '../comm/comm-text';
import { I18nService } from '../i18n/i18n.service';
import { clock } from './call-engine';
import { CallService } from './call.service';
import { CommService } from '../services/comm.service';

/** Full-screen call window (incoming / calling / in call). Shown over every page. */
@Component({
  selector: 'app-call-overlay',
  standalone: true,
  imports: [IonIcon],
  template: `
    @if (cs.state() !== 'idle') {
      <div class="call-screen" role="dialog" aria-modal="true" [attr.aria-label]="peer() + ': ' + status()">
        @if (cs.kind() === 'video') {
          <video class="remote" autoplay playsinline [srcObject]="cs.remote()" [class.hidden]="!cs.remote()"></video>
          @if (cs.local()) {
            <video class="local" autoplay playsinline [muted]="true" [srcObject]="cs.local()" [class.off]="cs.camOff()"></video>
          }
        } @else {
          <audio autoplay [srcObject]="cs.remote()"></audio>
        }

        <div class="info" [class.small]="cs.kind() === 'video' && cs.state() === 'active'">
          @if (!(cs.kind() === 'video' && cs.state() === 'active')) {
            <div class="avatar" aria-hidden="true">
              @if (photo()) { <img [src]="photo()" alt="" /> } @else { <ion-icon name="person"></ion-icon> }
            </div>
          }
          <h2>{{ peer() }}</h2>
          <p role="status" aria-live="polite">{{ status() }}</p>
        </div>

        <div class="controls">
          @if (cs.state() === 'incoming') {
            <button type="button" class="round red" (click)="cs.decline()" [attr.aria-label]="tx().call_decline"><ion-icon name="call" class="hang" aria-hidden="true"></ion-icon><span>{{ tx().call_decline }}</span></button>
            <button type="button" class="round green" (click)="cs.accept()" [attr.aria-label]="tx().call_accept"><ion-icon [name]="cs.kind() === 'video' ? 'videocam' : 'call'" aria-hidden="true"></ion-icon><span>{{ tx().call_accept }}</span></button>
          } @else if (cs.state() !== 'ended') {
            <button type="button" class="round" [class.on]="cs.muted()" [attr.aria-pressed]="cs.muted()" (click)="cs.toggleMute()"
                    [attr.aria-label]="cs.muted() ? tx().call_unmute : tx().call_mute"><ion-icon [name]="cs.muted() ? 'mic-off' : 'mic'" aria-hidden="true"></ion-icon><span>{{ cs.muted() ? tx().call_unmute : tx().call_mute }}</span></button>
            @if (cs.kind() === 'video') {
              <button type="button" class="round" [class.on]="cs.camOff()" [attr.aria-pressed]="cs.camOff()" (click)="cs.toggleCamera()"
                      [attr.aria-label]="cs.camOff() ? tx().call_cam_on : tx().call_cam_off"><ion-icon [name]="cs.camOff() ? 'videocam-off' : 'videocam'" aria-hidden="true"></ion-icon><span>{{ cs.camOff() ? tx().call_cam_on : tx().call_cam_off }}</span></button>
              <button type="button" class="round" (click)="cs.switchCamera()" [attr.aria-label]="tx().call_switch"><ion-icon name="camera-reverse" aria-hidden="true"></ion-icon><span>{{ tx().call_switch }}</span></button>
            }
            <button type="button" class="round red" (click)="cs.hangup()" [attr.aria-label]="tx().call_end"><ion-icon name="call" class="hang" aria-hidden="true"></ion-icon><span>{{ tx().call_end }}</span></button>
          }
        </div>
      </div>
    }
  `,
  styles: [
    `
      .call-screen {
        position: fixed; inset: 0; z-index: 99999; background: #10183d; color: #fff;
        display: flex; flex-direction: column; align-items: center; justify-content: space-between;
        padding: calc(24px + var(--ion-safe-area-top, 0px)) 16px calc(28px + var(--ion-safe-area-bottom, 0px));
      }
      .remote { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; background: #000; }
      .remote.hidden { display: none; }
      .local {
        position: absolute; right: 14px; bottom: 130px; width: 110px; height: 150px; object-fit: cover;
        border-radius: 12px; border: 2px solid rgba(255, 255, 255, 0.7); background: #000; z-index: 2; transform: scaleX(-1);
      }
      .local.off { opacity: 0.2; }
      .info { position: relative; z-index: 2; text-align: center; margin-top: 8vh; }
      .info.small { margin-top: 0; align-self: flex-start; text-align: left; text-shadow: 0 1px 3px #000; }
      .info.small h2 { font-size: 18px; }
      .avatar {
        width: 110px; height: 110px; border-radius: 50%; margin: 0 auto 16px; font-size: 56px;
        display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.12);
      }
      h2 { margin: 0 0 6px; font-size: 24px; }
      p { margin: 0; opacity: 0.9; font-size: 16px; }
      .controls { position: relative; z-index: 2; display: flex; gap: 18px; justify-content: center; flex-wrap: wrap; }
      .round {
        width: 66px; height: 66px; border-radius: 50%; border: 1px solid rgba(255, 255, 255, 0.22); background: rgba(255, 255, 255, 0.14);
        color: #fff; font-size: 28px; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center;
        position: relative; backdrop-filter: blur(6px); transition: transform 0.12s ease, background 0.15s ease;
      }
      .round:hover { transform: scale(1.05); }
      .round:active { transform: scale(0.96); }
      .round ion-icon { font-size: 28px; }
      .round .hang { transform: rotate(135deg); }
      .round.on { border-color: #fff; }
      .round.red { border-color: transparent; box-shadow: 0 6px 18px rgba(229, 57, 59, 0.45); }
      .round.green { border-color: transparent; box-shadow: 0 6px 18px rgba(31, 168, 85, 0.45); animation: ring 1.4s infinite; }
      @keyframes ring { 0%, 100% { box-shadow: 0 0 0 0 rgba(31, 168, 85, 0.55); } 50% { box-shadow: 0 0 0 14px rgba(31, 168, 85, 0); } }
      .avatar ion-icon { font-size: 48px; }
      .avatar img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
      .round span { position: absolute; top: 72px; font-size: 12px; white-space: nowrap; }
      .round.on { background: #fff; color: #10183d; }
      .round.red { background: #e5393b; }
      .round.green { background: #1fa855; }
      .round:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }
    `,
  ],
})
export class CallOverlayComponent {
  constructor() {
    addIcons({ call, cameraReverse, mic, micOff, person, videocam, videocamOff });
  }

  readonly cs = inject(CallService);
  private comm = inject(CommService);
  /** Name of the astrologer on this call. */
  /** The astrologer's photo ('' if none). */
  readonly photo = computed(() => this.comm.astroPhoto(this.comm.astrologers().find((a) => a.id === this.cs.staffId()), '300x300'));
  readonly peer = computed(() => String(this.comm.astrologers().find((a) => a.id === this.cs.staffId())?.['name'] || this.tx().msg_astrologer));
  private i18n = inject(I18nService);
  readonly tx = computed(() => COMM_TEXT[this.i18n.lang()]);

  readonly status = computed(() => {
    const t = this.tx();
    switch (this.cs.state()) {
      case 'outgoing':
        return t.call_calling;
      case 'incoming':
        return this.cs.kind() === 'video' ? t.call_incoming_video : t.call_incoming_audio;
      case 'connecting':
        return t.call_connecting;
      case 'active':
        return clock(this.cs.seconds());
      case 'ended': {
        const e = this.cs.end();
        if (e === 'declined') return t.call_declined;
        if (e === 'missed') return t.call_no_answer;
        if (e === 'failed') return t.call_failed;
        if (e === 'media') return t.call_no_media;
        return t.call_ended;
      }
      default:
        return '';
    }
  });
}
