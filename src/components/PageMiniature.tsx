"use client";

import { useState } from "react";

function screenshotUrl(pageUrl: string) {
  return `https://image.thum.io/get/width/960/crop/600/noanimate/${pageUrl}`;
}

export function PageMiniature({
  url,
  previewUrl,
  title,
}: {
  url: string;
  previewUrl?: string | null;
  title: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const host = url.replace(/^https?:\/\//, "").split("/")[0];
  const thumb = previewUrl || screenshotUrl(url);

  return (
    <div className="page-miniature" aria-hidden="true">
      <div className="page-miniature__chrome">
        <span />
        <span />
        <span />
        <em>{host}</em>
      </div>
      <div className="page-miniature__viewport">
        {!imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="page-miniature__shot"
            src={thumb}
            alt=""
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="page-miniature__fallback">
            {title.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
    </div>
  );
}
