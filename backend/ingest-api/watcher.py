from __future__ import annotations

import os
import shutil
import traceback
from pathlib import Path

from watchdog.events import FileCreatedEvent, FileSystemEventHandler
from watchdog.observers import Observer


class IncomingFileHandler(FileSystemEventHandler):
    def __init__(self, processor):
        self.processor = processor
        self.base_path = Path("/data")

    def on_created(self, event: FileCreatedEvent) -> None:
        if event.is_directory:
            return
        source = Path(event.src_path)
        try:
            with source.open("rb") as handle:
                self.processor(source.name, handle.read(), "public", "watcher")
            target = self.base_path / "processed" / source.name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(source), str(target))
        except Exception:
            target = self.base_path / "failed" / source.name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(source), str(target))
            (self.base_path / "failed" / f"{source.name}.error.log").write_text(traceback.format_exc(), encoding="utf-8")


def start_watcher(processor) -> Observer:
    incoming = Path(os.getenv("INCOMING_DIR", "/data/incoming"))
    incoming.mkdir(parents=True, exist_ok=True)
    observer = Observer()
    observer.schedule(IncomingFileHandler(processor), str(incoming), recursive=False)
    observer.daemon = True
    observer.start()
    return observer
