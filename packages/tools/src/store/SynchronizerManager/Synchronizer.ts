import type { Types } from '@cornerstonejs/core';
import {
  getRenderingEngine,
  getEnabledElement,
  eventTarget,
  Enums,
  getEnabledElementByViewportId,
} from '@cornerstonejs/core';

import type { ISynchronizerEventHandler } from '../../types';

type eventSource = 'element' | 'eventTarget';

type auxiliaryEvent = {
  name: string;
  source?: eventSource;
};

export type SynchronizerOptions = {
  auxiliaryEvents?: auxiliaryEvent[];
  eventSource?: eventSource;
  viewPresentation?: Types.ViewPresentation;
};

/**
 * Synchronizer is a class that listens to a specific event on a specific source
 * targets and fires a specific event on a specific target elements. Use cases
 * include: synchronizing a camera between two viewports, synchronizing a
 * windowLevel between various viewports.
 */
class Synchronizer {
  //
  private _enabled: boolean;
  private _eventName: string;
  private _auxiliaryEvents: auxiliaryEvent[];
  private _eventHandler: ISynchronizerEventHandler;
  private _eventSource: eventSource;
  private _ignoreFiredEvents: boolean;
  private _sourceViewports: Array<Types.IViewportId>;
  private _targetViewports: Array<Types.IViewportId>;
  private _viewportOptions: Record<string, Record<string, unknown>> = {};
  private _options: SynchronizerOptions;
  public id: string;

  constructor(
    synchronizerId: string,
    eventName: string,
    eventHandler: ISynchronizerEventHandler,
    options?: SynchronizerOptions
  ) {
    this._enabled = true;
    this._eventName = eventName;
    this._eventHandler = eventHandler;
    this._ignoreFiredEvents = false;
    this._sourceViewports = [];
    this._targetViewports = [];
    this._options = options || {};
    this._eventSource = this._options.eventSource || 'element';
    this._auxiliaryEvents = this._options.auxiliaryEvents || [];

    //
    this.id = synchronizerId;
  }

  /**
   * "Returns true if the synchronizer is disabled."
   * @returns A boolean value.
   */
  public isDisabled(): boolean {
    return !this._enabled || !this._hasSourceElements();
  }

  /**
   * Sets the options for the viewport id.  This can be used to
   * provide configuration on a viewport basis for things like offsets
   * to the general synchronization, or turn `on/off` synchronization of certain
   * attributes.
   */
  public setOptions(
    viewportId: string,
    options: Record<string, unknown> = {}
  ): void {
    this._viewportOptions[viewportId] = options;
  }

  /**
   * Sets a synchronizer enabled
   */
  public setEnabled(enabled: boolean) {
    this._enabled = enabled;
  }

  /** Gets the options for the given viewport id */
  public getOptions(viewportId: string): Record<string, unknown> | undefined {
    return this._viewportOptions[viewportId];
  }

  /**
   * Add a viewport to the list of targets and sources both.
   * @param viewportInfo - The viewportId and its renderingEngineId to add to the list of targets and sources.
   */
  public add(viewportInfo: Types.IViewportId): void {
    this.addTarget(viewportInfo);
    this.addSource(viewportInfo);
  }

  /**
   * Add a viewport to the list of sources (source ONLY)
   * @param viewportInfo - The viewportId and its renderingEngineId to add to the list of targets and sources.
   */
  public addSource(viewportInfo: Types.IViewportId): void {
    if (_containsViewport(this._sourceViewports, viewportInfo)) {
      return;
    }

    const { renderingEngineId, viewportId } = viewportInfo;

    const viewport =
      getRenderingEngine(renderingEngineId).getViewport(viewportId);

    if (!viewport) {
      console.warn(
        `Synchronizer.addSource: No viewport for ${renderingEngineId} ${viewportId}`
      );
      return;
    }

    const eventSource =
      this._eventSource === 'element' ? viewport.element : eventTarget;

    eventSource.addEventListener(this._eventName, this._onEvent.bind(this));

    this._auxiliaryEvents.forEach(({ name, source }) => {
      const target = source === 'element' ? viewport.element : eventTarget;
      target.addEventListener(name, this._onEvent.bind(this));
    });

    this._updateDisableHandlers();

    this._sourceViewports.push(viewportInfo);
  }

  /**
   * Add a viewport to the list of viewports that will get the eventHandler
   * executed when the event is fired on the source viewport.
   * @param viewportInfo - The viewportId and its renderingEngineId to add to the list of targets and sources.
   */
  public addTarget(viewportInfo: Types.IViewportId): void {
    if (_containsViewport(this._targetViewports, viewportInfo)) {
      return;
    }

    this._targetViewports.push(viewportInfo);
    this._updateDisableHandlers();
  }

  /**
   * Get the list of source viewports (as `{viewportId, renderingEngineId}` objects)
   * @returns An array of `{viewportId, renderingEngineId}` objects.
   */
  public getSourceViewports(): Array<Types.IViewportId> {
    return this._sourceViewports;
  }

  /**
   * Get the list of target viewports (as `{viewportId, renderingEngineId}` objects)
   * @returns An array of `{viewportId, renderingEngineId}` objects.
   */
  public getTargetViewports(): Array<Types.IViewportId> {
    return this._targetViewports;
  }

  public destroy(): void {
    this._sourceViewports.forEach((s) => this.removeSource(s));
    this._targetViewports.forEach((t) => this.removeTarget(t));
  }

  /**
   * Remove the viewport from the list of targets and sources
   * @param viewportInfo - The viewport info including viewportId and renderingEngineId.
   */
  public remove(viewportInfo: Types.IViewportId): void {
    this.removeTarget(viewportInfo);
    this.removeSource(viewportInfo);
  }

  /**
   * Remove the viewport from the list of source viewports
   * @param viewportInfo - The viewport info including viewportId and renderingEngineId.
   */
  public removeSource(viewportInfo: Types.IViewportId): void {
    const index = _getViewportIndex(this._sourceViewports, viewportInfo);

    if (index === -1) {
      return;
    }

    const eventSource =
      this._eventSource === 'element'
        ? this.getViewportElement(viewportInfo)
        : eventTarget;

    this._sourceViewports.splice(index, 1);

    //@ts-ignore
    eventSource.removeEventListener(this._eventName, this._eventHandler);

    this._auxiliaryEvents.forEach(({ name, source }) => {
      const target =
        source === 'element'
          ? this.getViewportElement(viewportInfo)
          : eventTarget;
      //@ts-ignore
      target.removeEventListener(name, this._eventHandler);
    });

    this._updateDisableHandlers();
  }

  /**
   * Remove the viewport from the list of viewports that are currently targeted by
   * this handler
   * @param viewportInfo - The viewport info including viewportId and renderingEngineId.
   *
   */
  public removeTarget(viewportInfo: Types.IViewportId): void {
    const index = _getViewportIndex(this._targetViewports, viewportInfo);

    if (index === -1) {
      return;
    }

    this._targetViewports.splice(index, 1);
    this._updateDisableHandlers();
  }

  public hasSourceViewport(
    renderingEngineId: string,
    viewportId: string
  ): boolean {
    return _containsViewport(this._sourceViewports, {
      renderingEngineId,
      viewportId,
    });
  }

  public hasTargetViewport(
    renderingEngineId: string,
    viewportId: string
  ): boolean {
    return _containsViewport(this._targetViewports, {
      renderingEngineId,
      viewportId,
    });
  }

  private fireEvent(
    sourceViewport: Types.IViewportId,
    sourceEvent: unknown
  ): void {
    if (this.isDisabled() || this._ignoreFiredEvents) {
      return;
    }

    this._ignoreFiredEvents = true;

    const promises = [];
    try {
      for (let i = 0; i < this._targetViewports.length; i++) {
        const targetViewport = this._targetViewports[i];
        const targetIsSource =
          sourceViewport.viewportId === targetViewport.viewportId;

        if (targetIsSource) {
          continue;
        }
        const result = this._eventHandler(
          this,
          sourceViewport,
          targetViewport,
          sourceEvent,
          this._options
        );

        // if the result is a promise, then add it to the list of promises
        // to wait for before setting _ignoreFiredEvents to false
        if (result instanceof Promise) {
          promises.push(result);
        }
      }
    } catch (ex) {
      console.warn(`Synchronizer, for: ${this._eventName}`, ex);
    } finally {
      if (promises.length) {
        Promise.allSettled(promises).then(() => {
          this._ignoreFiredEvents = false;
        });
      } else {
        this._ignoreFiredEvents = false;
      }
    }
  }

  private _onEvent = (evt: Event): void => {
    if (this._ignoreFiredEvents === true) {
      return;
    }

    // If no target viewports, then return immediately, this is useful
    // when switching between layouts, when previous layout has disabled
    // its viewports, and the new layout has not yet enabled them.
    // Right now we don't "delete" the synchronizer if all source and targets
    // are removed, but we may want to do that in the future.
    if (!this._targetViewports.length) {
      return;
    }

    const enabledElement =
      this._eventSource === 'element'
        ? getEnabledElement(evt.currentTarget as HTMLDivElement)
        : getEnabledElementByViewportId(
            (evt as CustomEvent).detail?.viewportId
          );

    if (!enabledElement) {
      return;
    }

    const { renderingEngineId, viewportId } = enabledElement;

    // If the viewport has been removed from the synchronizer before the event is
    // fired, then return immediately.
    if (!this._sourceViewports.find((s) => s.viewportId === viewportId)) {
      return;
    }

    this.fireEvent(
      {
        renderingEngineId,
        viewportId,
      },
      evt
    );
  };

  private _hasSourceElements(): boolean {
    return this._sourceViewports.length !== 0;
  }

  private _updateDisableHandlers(): void {
    const viewports = _getUniqueViewports(
      this._sourceViewports,
      this._targetViewports
    );
    const _remove = this.remove.bind(this);
    const disableHandler = (elementDisabledEvent) => {
      _remove(elementDisabledEvent.detail.element);
    };

    viewports.forEach((vp) => {
      const eventSource = this.getEventSource(vp);

      if (!eventSource) {
        return;
      }

      eventSource.removeEventListener(
        Enums.Events.ELEMENT_DISABLED,
        disableHandler
      );
      eventSource.addEventListener(
        Enums.Events.ELEMENT_DISABLED,
        disableHandler
      );
    });
  }

  private getEventSource(viewportInfo: Types.IViewportId): EventTarget {
    return this._eventSource === 'element'
      ? this.getViewportElement(viewportInfo)
      : eventTarget;
  }

  private getViewportElement(viewportInfo: Types.IViewportId): HTMLDivElement {
    const { renderingEngineId, viewportId } = viewportInfo;
    const renderingEngine = getRenderingEngine(renderingEngineId);
    if (!renderingEngine) {
      return null;
    }
    const viewport = renderingEngine.getViewport(viewportId);
    if (!viewport) {
      return null;
    }
    return viewport.element;
  }
}

function _getUniqueViewports(
  vp1: Array<Types.IViewportId>,
  vp2: Array<Types.IViewportId>
): Array<Types.IViewportId> {
  const unique = [];

  const vps = vp1.concat(vp2);

  for (let i = 0; i < vps.length; i++) {
    const vp = vps[i];
    if (
      !unique.some(
        (u) =>
          vp.renderingEngineId === u.renderingEngineId &&
          vp.viewportId === u.viewportId
      )
    ) {
      unique.push(vp);
    }
  }

  return unique;
}

function _getViewportIndex(
  arr: Array<Types.IViewportId>,
  vp: Types.IViewportId
): number {
  return arr.findIndex(
    (ar) =>
      vp.renderingEngineId === ar.renderingEngineId &&
      vp.viewportId === ar.viewportId
  );
}

function _containsViewport(
  arr: Array<Types.IViewportId>,
  vp: Types.IViewportId
) {
  return arr.some(
    (ar) =>
      ar.renderingEngineId === vp.renderingEngineId &&
      ar.viewportId === vp.viewportId
  );
}

export default Synchronizer;
