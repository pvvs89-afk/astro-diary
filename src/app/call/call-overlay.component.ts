import { Component, computed, inject } from '@angular/core';
import { COMM_TEXT } from '../comm/comm-text';
import { I18nService } from '../i18n/i18n.service';
import { clock } from './call-engine';
import { CallService } from './call.service';

/** Full-screen call window (incoming / calling / in call). Shown over every page. */
@Component({
  selector: 'app-call-overlay',
  standalone: true,
  template: `
    @if (cs.state() !== 'idle') {
      <div class="call-screen" role="dialog" aria-modal="true" [attr.aria-label]="tx().msg_astrologer + ': ' + status()">
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
            <div class="avatar" aria-hidden="true">🔮</div>
          }
          <h2>{{ tx().msg_astrologer }}</h2>
          <p role="status" aria-live="polite">{{ status() }}</p>
        </div>

        <div class="controls">
          @if (cs.state() === 'incoming') {
            <button type="button" class="round red" (click)="cs.decline()" [attr.aria-label]="tx().call_decline">✕<span>{{ tx().call_decline }}</span></button>
            <button type="button" class="round green" (click)="cs.accept()" [attr.aria-label]="tx().call_accept">{{ cs.kind() === 'video' ? '🎥' : '📞' }}<span>{{ tx().call_accept }}</span></button>
          } @else if (cs.state() !== 'ended') {
            <button type="button" class="round" [class.on]="cs.muted()" [attr.aria-pressed]="cs.muted()" (click)="cs.toggleMute()"
                    [attr.aria-label]="cs.muted() ? tx().call_unmute : tx().call_mute">{{ cs.muted() ? '🔇' : '🎤' }}<span>{{ cs.muted() ? tx().call_unmute : tx().call_mute }}</span></button>
            @if (cs.kind() === 'video') {
              <button type="button" class="round" [class.on]="cs.camOff()" [attr.aria-pressed]="cs.camOff()" (click)="cs.toggleCamera()"
                      [attr.aria-label]="cs.camOff() ? tx().call_cam_on : tx().call_cam_off">📷<span>{{ cs.camOff() ? tx().call_cam_on : tx().call_cam_off }}</span></button>
              <button type="button" class="round" (click)="cs.switchCamera()" [attr.aria-label]="tx().call_switch">🔄<span>{{ tx().call_switch }}</span></button>
            }
            <button type="button" class="round red" (click)="cs.hangup()" [attr.aria-label]="tx().call_end">✆<span>{{ tx().call_end }}</span></button>
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
        width: 66px; height: 66px; border-radius: 50%; border: 0; background: rgba(255, 255, 255, 0.18); color: #fff;
        font-size: 26px; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative;
      }
      .round span { position: absolute; top: 72px; font-size: 12px; white-space: nowrap; }
      .round.on { background: #fff; color: #10183d; }
      .round.red { background: #e5393b; }
      .round.green { background: #1fa855; }
      .round:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }
    `,
  ],
})
export class CallOverlayComponent {
  readonly cs = inject(CallService);
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
