"use client";

import {
  Card,
  CardTitle,
  CardBody,
  CardHeader,
  Flex,
  FlexItem,
  Content,
  Label,
} from "@patternfly/react-core";
import { LockIcon } from "@patternfly/react-icons";
import type { Link } from "@/lib/types";
import { StatusDot } from "./StatusDot";
import { PageMiniature } from "./PageMiniature";

export function LinkCard({ link }: { link: Link; index?: number }) {
  const hasAuth = Boolean(link.auth_username);

  return (
    <Card isClickable isFullHeight>
      <PageMiniature
        url={link.url}
        previewUrl={link.preview_url}
        title={link.title}
      />
      <CardHeader
        selectableActions={{
          selectableActionAriaLabel: `Open ${link.title} in a new window`,
          onClickAction: () => {
            // Auth links go through /bridge so credentials can be injected
            // server-side (browsers strip user:pass@host URLs).
            const href = hasAuth ? `/bridge/${link.id}/` : `/go/${link.id}`;
            window.open(href, "_blank", "noopener,noreferrer");
          },
        }}
      >
        <Flex
          alignItems={{ default: "alignItemsCenter" }}
          spaceItems={{ default: "spaceItemsSm" }}
          style={{ width: "100%" }}
        >
          {link.icon_url && (
            <FlexItem>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={link.icon_url}
                alt=""
                width={18}
                height={18}
                style={{ display: "block" }}
              />
            </FlexItem>
          )}
          <FlexItem flex={{ default: "flex_1" }}>
            <CardTitle>{link.title}</CardTitle>
          </FlexItem>
          {hasAuth && (
            <FlexItem>
              <Label isCompact color="orange" icon={<LockIcon />}>
                auth
              </Label>
            </FlexItem>
          )}
          <FlexItem>
            <StatusDot status={link.last_status} latencyMs={link.last_latency_ms} />
          </FlexItem>
        </Flex>
      </CardHeader>
      <CardBody>
        {link.description && (
          <Content component="p" className="pf-v6-u-mb-sm">
            {link.description}
          </Content>
        )}
        <Content component="small">
          {link.url.replace(/^https?:\/\//, "")}
        </Content>
      </CardBody>
    </Card>
  );
}
