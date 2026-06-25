export type Sprite<TAnimations extends Record<string, Animation> = Record<string, Animation>> = {
  overlayCount: number;
  sounds: string[];
  frameSize: [number, number];
  animations: TAnimations;
};

export type AnimationName<TSprite> =
  TSprite extends Sprite<infer TAnimations> ? keyof TAnimations & string : never;

export type Animation = {
  frames: Frame[];
};

export type Frame = {
  duration: number;
  images?: [[number, number]];
  sound?: string;
  exitBranch?: number;
  branching?: {
    branches: Branch[];
  };
};

export type Branch = {
  frameIndex: number;
  weight: number;
};

export type SoundIndex = Record<number, string>;
