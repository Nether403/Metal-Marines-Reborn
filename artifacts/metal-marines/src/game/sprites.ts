export type SpriteFrame = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type SpriteDefinition = SpriteFrame & {
  atlas: string;
  anchorX?: number;
  anchorY?: number;
};

export type AnimationDefinition = {
  frames: string[];
  frameMs: number;
  loop?: boolean;
};

export type SpriteManifest = {
  atlases?: Record<string, string>;
  sprites?: Record<string, SpriteDefinition>;
  animations?: Record<string, AnimationDefinition>;
};

type AtlasState = "idle" | "loading" | "ready" | "error";

const isBrowser = typeof window !== "undefined" && typeof Image !== "undefined";

export class SpriteAtlas {
  readonly id: string;
  readonly src: string;
  readonly image: HTMLImageElement | null;
  state: AtlasState = "idle";
  error: unknown = null;
  private loadPromise: Promise<void> | null = null;

  constructor(id: string, src: string) {
    this.id = id;
    this.src = src;
    this.image = isBrowser ? new Image() : null;
  }

  load(): Promise<void> {
    if (!this.image) {
      this.state = "error";
      return Promise.resolve();
    }
    if (this.state === "ready") return Promise.resolve();
    if (this.loadPromise) return this.loadPromise;

    this.state = "loading";
    this.loadPromise = new Promise((resolve) => {
      if (!this.image) {
        this.state = "error";
        resolve();
        return;
      }

      this.image.onload = () => {
        this.state = "ready";
        resolve();
      };
      this.image.onerror = (event) => {
        this.state = "error";
        this.error = event;
        resolve();
      };
      this.image.src = this.src;
    });

    return this.loadPromise;
  }

  get ready(): boolean {
    return this.state === "ready" && !!this.image?.complete;
  }
}

export class AnimatedSprite {
  readonly frames: string[];
  readonly frameMs: number;
  readonly loop: boolean;

  constructor(definition: AnimationDefinition) {
    this.frames = definition.frames;
    this.frameMs = definition.frameMs;
    this.loop = definition.loop ?? true;
  }

  frameAt(timeMs: number): string | null {
    if (!this.frames.length) return null;
    const rawIndex = Math.max(0, Math.floor(timeMs / Math.max(1, this.frameMs)));
    const index = this.loop ? rawIndex % this.frames.length : Math.min(this.frames.length - 1, rawIndex);
    return this.frames[index] ?? null;
  }
}

export type DrawSpriteOptions = {
  scale?: number;
  alpha?: number;
  flipX?: boolean;
  rotation?: number;
};

export class SpriteManager {
  private atlases = new Map<string, SpriteAtlas>();
  private sprites = new Map<string, SpriteDefinition>();
  private animations = new Map<string, AnimatedSprite>();
  private preloadPromise: Promise<void> | null = null;

  registerManifest(manifest: SpriteManifest, basePath = ""): void {
    for (const [id, src] of Object.entries(manifest.atlases ?? {})) {
      this.atlases.set(id, new SpriteAtlas(id, joinAssetPath(basePath, src)));
    }
    for (const [name, definition] of Object.entries(manifest.sprites ?? {})) {
      this.sprites.set(name, definition);
    }
    for (const [name, definition] of Object.entries(manifest.animations ?? {})) {
      this.animations.set(name, new AnimatedSprite(definition));
    }
    this.preloadPromise = null;
  }

  async loadManifest(url: string, basePath = url.slice(0, url.lastIndexOf("/") + 1)): Promise<void> {
    try {
      const response = await fetch(url);
      if (!response.ok) return;
      const manifest = (await response.json()) as SpriteManifest;
      this.registerManifest(manifest, basePath);
      await this.preload();
    } catch {
      // Missing or malformed manifests are non-fatal; renderers should fall back.
    }
  }

  preload(): Promise<void> {
    if (!this.preloadPromise) {
      this.preloadPromise = Promise.all([...this.atlases.values()].map((atlas) => atlas.load())).then(
        () => undefined
      );
    }
    return this.preloadPromise;
  }

  hasSprite(name: string): boolean {
    return this.sprites.has(name);
  }

  getAnimation(name: string): AnimatedSprite | undefined {
    return this.animations.get(name);
  }

  animationFrame(name: string, timeMs: number): string | null {
    return this.animations.get(name)?.frameAt(timeMs) ?? null;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    name: string,
    x: number,
    y: number,
    options: DrawSpriteOptions = {}
  ): boolean {
    const sprite = this.sprites.get(name);
    if (!sprite) return false;
    const atlas = this.atlases.get(sprite.atlas);
    if (!atlas?.ready || !atlas.image) return false;

    const scale = options.scale ?? 1;
    const dw = sprite.w * scale;
    const dh = sprite.h * scale;
    const anchorX = sprite.anchorX ?? 0.5;
    const anchorY = sprite.anchorY ?? 0.5;

    ctx.save();
    ctx.globalAlpha *= options.alpha ?? 1;
    ctx.translate(x, y);
    if (options.rotation) ctx.rotate(options.rotation);
    if (options.flipX) ctx.scale(-1, 1);
    ctx.drawImage(atlas.image, sprite.x, sprite.y, sprite.w, sprite.h, -dw * anchorX, -dh * anchorY, dw, dh);
    ctx.restore();
    return true;
  }
}

const joinAssetPath = (basePath: string, src: string): string => {
  if (/^(https?:)?\/\//.test(src) || src.startsWith("/")) return src;
  return `${basePath}${src}`;
};

export const spriteManager = new SpriteManager();

let defaultManifestLoad: Promise<void> | null = null;

export const preloadGameSprites = (): Promise<void> => {
  if (!defaultManifestLoad) {
    defaultManifestLoad = spriteManager.loadManifest("/game-assets/manifests/core.json");
  }
  return defaultManifestLoad;
};
