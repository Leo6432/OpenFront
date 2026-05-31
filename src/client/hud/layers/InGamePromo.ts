import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { GameView } from "../../../core/game/GameView";
import { Controller } from "../../Controller";

@customElement("in-game-promo")
export class InGamePromo extends LitElement implements Controller {
  public game: GameView;

  createRenderRoot() {
    return this;
  }

  init() {}
  tick() {}
  public hideAd(): void {}

  render() {
    return html``;
  }
}
