(function(app) {
  'use strict';

  class UndoManager {
    constructor(maxSize, onChange) {
      this.stack = [];
      this.index = -1;
      this.maxSize = maxSize || 50;
      this._isUndoRedo = false;
      this._textEditSnapshot = null;
      this._hasPendingChange = false;
      this.onChange = onChange; // Callback for UI updates
    }

    push(currentState) {
      if (this._isUndoRedo) return;
      this.commitTextEdit(currentState);

      const clone = JSON.parse(JSON.stringify(currentState));

      if (this.index === -1) {
        this.stack = [clone];
        this.index = 0;
        this._hasPendingChange = false;
        this._updateButtons();
        return;
      }

      this.stack = this.stack.slice(0, this.index + 1);

      if (JSON.stringify(clone) === JSON.stringify(this.stack[this.index])) {
        this._hasPendingChange = false;
        this._updateButtons();
        return;
      }

      this.stack.push(clone);
      if (this.stack.length > this.maxSize) {
        this.stack.shift();
      } else {
        this.index++;
      }
      this._hasPendingChange = false;
      this._updateButtons();
    }

    refresh(currentState) {
      if (this._isUndoRedo) return;
      this.commitTextEdit(currentState);

      this._hasPendingChange = this.index >= 0 &&
        JSON.stringify(currentState) !== JSON.stringify(this.stack[this.index]);

      if (this._hasPendingChange && this.index < this.stack.length - 1) {
        this.stack = this.stack.slice(0, this.index + 1);
      }

      this._updateButtons();
    }

    undo(currentState) {
      this.commitTextEdit(currentState);
      if (this.index < 0) return null;

      if (this.index === this.stack.length - 1 && currentState) {
        const clone = JSON.parse(JSON.stringify(currentState));
        if (JSON.stringify(clone) !== JSON.stringify(this.stack[this.index])) {
          this.stack.push(clone);
          this.index++;
          if (this.stack.length > this.maxSize) {
            this.stack.shift();
            this.index--;
          }
        }
      }

      this._hasPendingChange = false;
      if (this.index <= 0) {
        this._updateButtons();
        return null;
      }

      this._isUndoRedo = true;
      this.index--;
      const snapshot = JSON.parse(JSON.stringify(this.stack[this.index]));
      this._isUndoRedo = false;
      this._updateButtons();
      return snapshot;
    }

    redo() {
      if (this.index >= this.stack.length - 1) return null;
      this._isUndoRedo = true;
      this.index++;
      const snapshot = JSON.parse(JSON.stringify(this.stack[this.index]));
      this._isUndoRedo = false;
      this._hasPendingChange = false;
      this._updateButtons();
      return snapshot;
    }

    snapshotTextEdit(currentState) {
      if (this._isUndoRedo) return;
      if (!this._textEditSnapshot) {
        this._textEditSnapshot = JSON.parse(JSON.stringify(currentState));
      }
    }

    commitTextEdit(currentState) {
      if (this._textEditSnapshot) {
        if (this._isUndoRedo) { this._textEditSnapshot = null; return; }
        const preState = this._textEditSnapshot;
        this._textEditSnapshot = null;

        this.stack = this.stack.slice(0, this.index + 1);

        if (JSON.stringify(preState) !== JSON.stringify(currentState)) {
          if (this.index === -1) {
            this.stack = [preState];
            this.index = 0;
          } else if (JSON.stringify(preState) !== JSON.stringify(this.stack[this.index])) {
            this.stack.push(preState);
            if (this.stack.length > this.maxSize) {
              this.stack.shift();
            } else {
              this.index++;
            }
          }
        }
        this._hasPendingChange = this.index >= 0 &&
          JSON.stringify(currentState) !== JSON.stringify(this.stack[this.index]);
        this._updateButtons();
      }
    }

    clear() {
      this.stack = [];
      this.index = -1;
      this._textEditSnapshot = null;
      this._hasPendingChange = false;
      this._updateButtons();
    }

    _updateButtons() {
      if (this.onChange) {
        this.onChange(this.index > 0 || this._hasPendingChange, this.index < this.stack.length - 1);
      }
    }
  }

  app.UndoManager = UndoManager;

})(window.ChartApp = window.ChartApp || {});
