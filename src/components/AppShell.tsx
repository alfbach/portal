"use client";

import {
  Masthead,
  MastheadMain,
  MastheadBrand,
  MastheadContent,
  MastheadLogo,
  MastheadToggle,
  Page,
  PageSection,
  PageSidebar,
  PageSidebarBody,
  PageToggleButton,
  Nav,
  NavList,
  NavItem,
  Flex,
  FlexItem,
  Title,
  Content,
  Button,
} from "@patternfly/react-core";
import { BarsIcon, CogIcon, FolderIcon, ThIcon } from "@patternfly/react-icons";
import { ColorModeToggle } from "./ColorModeToggle";
import type { LinkGroup } from "@/lib/types";

export type MenuSelection = "all" | "ungrouped" | number;

export function AppShell({
  children,
  title = "OPS Portal",
  showAdminLink = true,
  groups = [],
  activeMenu = "all",
  onMenuSelect,
  showGroupNav = true,
}: {
  children: React.ReactNode;
  title?: string;
  showAdminLink?: boolean;
  groups?: LinkGroup[];
  activeMenu?: MenuSelection;
  onMenuSelect?: (selection: MenuSelection) => void;
  showGroupNav?: boolean;
}) {
  const sidebar = showGroupNav ? (
    <PageSidebar>
      <PageSidebarBody>
        <Nav aria-label="Link groups">
          <NavList>
            <NavItem
              itemId="all"
              isActive={activeMenu === "all"}
              onClick={(e) => {
                e.preventDefault();
                onMenuSelect?.("all");
              }}
              to="#"
            >
              <ThIcon className="pf-v6-u-mr-sm" />
              All links
            </NavItem>
            {groups
              .filter((g) => g.enabled)
              .map((group) => (
                <NavItem
                  key={group.id}
                  itemId={`group-${group.id}`}
                  isActive={activeMenu === group.id}
                  onClick={(e) => {
                    e.preventDefault();
                    onMenuSelect?.(group.id);
                  }}
                  to="#"
                >
                  <FolderIcon className="pf-v6-u-mr-sm" />
                  {group.name}
                </NavItem>
              ))}
            <NavItem
              itemId="ungrouped"
              isActive={activeMenu === "ungrouped"}
              onClick={(e) => {
                e.preventDefault();
                onMenuSelect?.("ungrouped");
              }}
              to="#"
            >
              <FolderIcon className="pf-v6-u-mr-sm" />
              Ungrouped
            </NavItem>
          </NavList>
        </Nav>
      </PageSidebarBody>
    </PageSidebar>
  ) : null;

  return (
    <Page
      isManagedSidebar={showGroupNav}
      defaultManagedSidebarIsOpen
      masthead={
        <Masthead>
          <MastheadMain>
            {showGroupNav && (
              <MastheadToggle>
                <PageToggleButton
                  variant="plain"
                  aria-label="Global navigation"
                  isHamburgerButton
                >
                  <BarsIcon />
                </PageToggleButton>
              </MastheadToggle>
            )}
            <MastheadBrand>
              <MastheadLogo href="/">
                <Title headingLevel="h1" size="xl">
                  {title}
                </Title>
              </MastheadLogo>
            </MastheadBrand>
          </MastheadMain>
          <MastheadContent>
            <Flex
              alignItems={{ default: "alignItemsCenter" }}
              justifyContent={{ default: "justifyContentFlexEnd" }}
              spaceItems={{ default: "spaceItemsMd" }}
              style={{ width: "100%" }}
            >
              <FlexItem>
                <ColorModeToggle />
              </FlexItem>
              {showAdminLink && (
                <FlexItem>
                  <Button
                    variant="secondary"
                    component="a"
                    href="/admin"
                    icon={<CogIcon />}
                  >
                    Admin
                  </Button>
                </FlexItem>
              )}
            </Flex>
          </MastheadContent>
        </Masthead>
      }
      sidebar={sidebar}
    >
      <PageSection>{children}</PageSection>
    </Page>
  );
}

export function SectionHeader({
  title,
  meta,
}: {
  title: string;
  meta?: string;
}) {
  return (
    <Flex
      justifyContent={{ default: "justifyContentSpaceBetween" }}
      alignItems={{ default: "alignItemsBaseline" }}
      className="pf-v6-u-mb-md"
    >
      <FlexItem>
        <Title headingLevel="h2" size="lg">
          {title}
        </Title>
      </FlexItem>
      {meta && (
        <FlexItem>
          <Content component="small">{meta}</Content>
        </FlexItem>
      )}
    </Flex>
  );
}
