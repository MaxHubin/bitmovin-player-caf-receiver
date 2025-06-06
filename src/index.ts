import { CastReceiverContext, ContentProtection, NetworkRequestInfo, PlayerManager } from 'chromecast-caf-receiver/cast.framework';
import { LoadRequestData } from 'chromecast-caf-receiver/cast.framework.messages';
import { CAFDrmConfig, CAFMediaInfoCustomData, CAFSourceOptions } from 'bitmovin-player';

const CAST_MESSAGE_NAMESPACE = 'urn:x-cast:com.bitmovin.player.caf';


export default class CAFReceiver {
  private readonly player: PlayerManager;
  private readonly context: CastReceiverContext;

  constructor() {
    this.context = cast.framework.CastReceiverContext.getInstance();
    this.player = this.context.getPlayerManager();
  }

  public init() {
    // cast.framework.CastReceiverContext.getInstance().setLoggerLevel(cast.framework.LoggerLevel.DEBUG);

    this.attachEvents();

    const options = new cast.framework.CastReceiverOptions();
    options.useShakaForHls = true;
    // options.shakaVersion = '4.3.5';
    // options.shakaVariant = cast.framework.ShakaVariant.DEBUG;

    this.context.start(options);
  }

  private attachEvents() {
    this.player.setMessageInterceptor(cast.framework.messages.MessageType.LOAD, this.onLoad);
    this.context.addCustomMessageListener(CAST_MESSAGE_NAMESPACE, this.onCustomMessage);
  }

  private readonly onLoad = (loadRequestData: LoadRequestData): LoadRequestData => {
    const customData = loadRequestData.media.customData as CAFMediaInfoCustomData;

    if (customData?.options) {
      this.setWithCredentials(customData.options);
    }

    if (customData?.drm) {
      this.setDRM(customData.drm);
    }

    return loadRequestData;
  };

  private setDRM({ protectionSystem, licenseUrl, headers, withCredentials }: CAFDrmConfig): void {
    this.context.getPlayerManager().setMediaPlaybackInfoHandler((_loadRequest, playbackConfig) => {
      playbackConfig.licenseUrl = licenseUrl;
      playbackConfig.protectionSystem = protectionSystem as ContentProtection;

      if (typeof headers === 'object') {
        playbackConfig.licenseRequestHandler = (requestInfo) => {
          requestInfo.headers = headers;
        };
      }

      if (withCredentials) {
        playbackConfig.licenseRequestHandler = setWithCredentialsFlag;
      }

      return playbackConfig;
    });
  }

  private setWithCredentials(options: CAFSourceOptions): void {
    const playerManager = this.context.getPlayerManager();
    const playbackConfig = Object.assign(new cast.framework.PlaybackConfig(), playerManager.getPlaybackConfig());

    if (options.withCredentials) {
      playbackConfig.segmentRequestHandler = setWithCredentialsFlag;
      playbackConfig.captionsRequestHandler = setWithCredentialsFlag;
    }

    if (options.manifestWithCredentials) {
      playbackConfig.manifestRequestHandler = setWithCredentialsFlag;
    }

    playerManager.setPlaybackConfig(playbackConfig);
  }

  private readonly onCustomMessage: SystemEventHandler = (message) => {
    console.log('Received custom channel message', message);
  };
}

function setWithCredentialsFlag(requestInfo: NetworkRequestInfo): void {
  requestInfo.withCredentials = true;
}
