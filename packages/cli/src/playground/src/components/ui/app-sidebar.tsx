'use client';

import { DraftingCompass, Network, Workflow } from 'lucide-react';
import { Link, useLocation } from 'react-router';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';

export const LogoWithoutText = (props: { className: string }) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="21" height="21" viewBox="0 0 21 21" fill="none">
    <rect x="0.605469" y="0.5" width="20" height="20" rx="2.18625" fill="black" />
    <circle cx="10.6059" cy="10.5004" r="6.0121" stroke="url(#paint0_linear_18520_30330)" strokeWidth="0.766389" />
    <ellipse
      cx="10.6069"
      cy="10.501"
      rx="6.0121"
      ry="4.0324"
      transform="rotate(45 10.6069 10.501)"
      stroke="url(#paint1_linear_18520_30330)"
      strokeWidth="0.766389"
    />
    <path d="M8.15234 10.5234H13.0931" stroke="url(#paint2_linear_18520_30330)" strokeWidth="0.766389" />
    <path d="M9.36523 11.7773L11.8755 9.26708" stroke="url(#paint3_linear_18520_30330)" strokeWidth="0.766389" />
    <path d="M11.877 11.7773L9.36669 9.26708" stroke="url(#paint4_linear_18520_30330)" strokeWidth="0.766389" />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M6.49185 7.85663C5.44831 8.55655 4.84055 9.49673 4.84055 10.5025C4.84055 11.5082 5.44831 12.4484 6.49185 13.1483C7.5338 13.8472 8.98737 14.2875 10.6052 14.2875C12.2231 14.2875 13.6767 13.8472 14.7186 13.1483C15.7621 12.4484 16.3699 11.5082 16.3699 10.5025C16.3699 9.49673 15.7621 8.55655 14.7186 7.85663C13.6767 7.15778 12.2231 6.7175 10.6052 6.7175C8.98737 6.7175 7.5338 7.15778 6.49185 7.85663ZM6.21621 7.44566C7.35021 6.68507 8.9027 6.22266 10.6052 6.22266C12.3078 6.22266 13.8602 6.68507 14.9942 7.44566C16.1267 8.20518 16.8648 9.2812 16.8648 10.5025C16.8648 11.7238 16.1267 12.7998 14.9942 13.5593C13.8602 14.3199 12.3078 14.7823 10.6052 14.7823C8.9027 14.7823 7.35021 14.3199 6.21621 13.5593C5.0838 12.7998 4.3457 11.7238 4.3457 10.5025C4.3457 9.2812 5.0838 8.20518 6.21621 7.44566Z"
      fill="url(#paint5_linear_18520_30330)"
    />
    <defs>
      <linearGradient
        id="paint0_linear_18520_30330"
        x1="10.6059"
        y1="4.48828"
        x2="10.6059"
        y2="16.5125"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#CACACA" />
        <stop offset="1" stopColor="#5C5C5C" />
      </linearGradient>
      <linearGradient
        id="paint1_linear_18520_30330"
        x1="10.6069"
        y1="6.46857"
        x2="10.6069"
        y2="14.5334"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#CACACA" />
        <stop offset="1" stopColor="#5C5C5C" />
      </linearGradient>
      <linearGradient
        id="paint2_linear_18520_30330"
        x1="10.6227"
        y1="10.5234"
        x2="10.6227"
        y2="11.5234"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#CACACA" />
        <stop offset="1" stopColor="#5C5C5C" />
      </linearGradient>
      <linearGradient
        id="paint3_linear_18520_30330"
        x1="10.6204"
        y1="10.5222"
        x2="11.3275"
        y2="11.2293"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#CACACA" />
        <stop offset="1" stopColor="#5C5C5C" />
      </linearGradient>
      <linearGradient
        id="paint4_linear_18520_30330"
        x1="10.6218"
        y1="10.5222"
        x2="11.3289"
        y2="9.81511"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#CACACA" />
        <stop offset="1" stopColor="#5C5C5C" />
      </linearGradient>
      <linearGradient
        id="paint5_linear_18520_30330"
        x1="10.6052"
        y1="6.22266"
        x2="10.6052"
        y2="14.7823"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#CACACA" />
        <stop offset="1" stopColor="#5C5C5C" />
      </linearGradient>
    </defs>
  </svg>
);

export const Agent = () => {
  return (
    <svg width="17" height="16" viewBox="0 0 17 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8.90625 13.7C12.0543 13.7 14.6062 11.148 14.6062 8C14.6062 4.85198 12.0543 2.3 8.90625 2.3C5.75823 2.3 3.20625 4.85198 3.20625 8C3.20625 11.148 5.75823 13.7 8.90625 13.7ZM8.90625 15C12.7722 15 15.9062 11.866 15.9062 8C15.9062 4.13401 12.7722 1 8.90625 1C5.04026 1 1.90625 4.13401 1.90625 8C1.90625 11.866 5.04026 15 8.90625 15Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M15.4652 10.2358C14.5313 12.8424 12.0391 14.707 9.11131 14.707C9.0617 14.707 9.01222 14.7065 8.96286 14.7054C8.2899 13.0924 7.99638 11.3949 8.24344 9.55135C8.32897 9.24542 8.44745 8.7986 8.42849 8.39404C8.41982 8.20891 8.21671 8.23135 8.16572 8.40953C8.10356 8.62678 8.01682 8.85452 7.90686 9.05582C7.7808 9.07647 7.61987 9.09091 7.41708 9.07898C6.77839 9.04141 6.30758 8.70811 6.207 8.60035C6.0243 8.68313 6.01285 8.74449 6.0019 8.80318C5.99501 8.8401 5.98832 8.87596 5.93935 8.91543L5.92431 8.92772C5.83552 9.00073 5.7706 9.05411 5.56668 8.74463C5.38324 8.38491 5.24798 7.85962 5.79957 7.29461C6.1277 6.9585 6.78378 6.68405 6.87725 6.66968C6.87725 6.13802 7.29396 5.17963 8.48684 4.84422C9.74529 4.49038 11.198 4.84991 12.0373 6.07673C12.5645 6.84745 12.6162 7.29277 12.6557 7.6326C12.6968 7.98678 12.7247 8.22638 13.2636 8.60035C13.4125 8.70365 13.5621 8.80449 13.7129 8.90615C14.2705 9.28209 14.8452 9.66951 15.4652 10.2358ZM8.8836 6.73288C9.08285 6.73288 9.24437 6.57136 9.24437 6.37211C9.24437 6.17286 9.08285 6.01134 8.8836 6.01134C8.68436 6.01134 8.52284 6.17286 8.52284 6.37211C8.52284 6.57136 8.68436 6.73288 8.8836 6.73288Z"
        fill="currentColor"
      />
    </svg>
  );
};

const EvaluatorIcon = () => {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12.1322 0.84375C11.7426 0.84375 11.4268 1.15959 11.4268 1.54919V5.89612C11.4268 6.28572 11.7426 6.60156 12.1322 6.60156C12.5218 6.60156 12.8376 6.28572 12.8376 5.89612V1.54919C12.8376 1.15959 12.5218 0.84375 12.1322 0.84375ZM1.39829 2.35617C1.77336 1.9811 2.28207 1.77039 2.8125 1.77039C3.34293 1.77039 3.85164 1.9811 4.22671 2.35617C4.60179 2.73124 4.8125 3.23995 4.8125 3.77039V4.27039C4.8125 4.80082 4.60179 5.30953 4.22671 5.6846C3.85164 6.05967 3.34293 6.27039 2.8125 6.27039C2.28207 6.27039 1.77336 6.05967 1.39829 5.6846C1.02321 5.30953 0.8125 4.80082 0.8125 4.27039V3.77039C0.8125 3.23995 1.02321 2.73124 1.39829 2.35617ZM4.51212 7.77039C4.80049 7.77039 5.07482 7.89488 5.26471 8.1119L7.805 11.0153C8.37073 11.6618 7.91155 12.6737 7.0524 12.6737H1.87806C1.32577 12.6737 0.878059 12.226 0.878059 11.6737V9.06351C0.878059 8.79835 0.978608 8.53756 1.1901 8.37761C1.39315 8.22405 1.61537 8.09662 1.85161 7.99876C2.21571 7.84794 2.60596 7.77034 3.00006 7.77039H4.51212ZM7.12537 5.07715C6.73576 5.07715 6.41992 5.39299 6.41992 5.78259V5.93944C6.41992 6.32904 6.73576 6.64488 7.12537 6.64488C7.51497 6.64488 7.83081 6.32904 7.83081 5.93944V5.78259C7.83081 5.39299 7.51497 5.07715 7.12537 5.07715ZM8.92383 3.66608C8.92383 3.27647 9.23967 2.96063 9.62927 2.96063C10.0189 2.96063 10.3347 3.27647 10.3347 3.66608V5.98517C10.3347 6.37477 10.0189 6.69061 9.62927 6.69061C9.23967 6.69061 8.92383 6.37477 8.92383 5.98517V3.66608Z"
        fill="currentColor"
      />
    </svg>
  );
};

const links = [
  {
    name: 'Agents',
    url: '/agents',
    icon: Agent,
  },
  {
    name: 'Networks',
    url: '/networks',
    icon: Network,
  },
  {
    name: 'Tools',
    url: '/tools',
    icon: DraftingCompass,
  },
  {
    name: 'Workflows',
    url: '/workflows',
    icon: Workflow,
  },
  {
    name: 'Evaluators',
    url: '/evaluators',
    icon: EvaluatorIcon,
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="w-full pt-4 pb-4 pl-1">
        <span className="flex shrink-0">
          {state === 'collapsed' ? (
            <LogoWithoutText className="w-10 h-10 pl-0 shrink-0" />
          ) : (
            <span className="flex items-center gap-0.5">
              <LogoWithoutText className="w-10 h-10 pl-0 shrink-0" />
              <span className="font-serif text-sm">Mastra</span>
            </span>
          )}
        </span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {links.map((item, index) => {
                const [_, pagePath] = pathname.split('/');
                const lowercasedPagePath = item.name.toLowerCase();
                const isActive = item.url === pathname || item.name === pathname || pagePath === lowercasedPagePath;
                return (
                  <SidebarMenuItem key={`${item.name}-${index}`}>
                    <SidebarMenuButton tooltip={item.name} asChild>
                      <Link
                        className={`group/icon ${isActive ? 'text-primary bg-muted/50' : 'text-[#939393]'}`}
                        to={item.url}
                      >
                        <item.icon />
                        <span className="text-[0.8rem] font-normal">{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="pl-0">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="group-[data-collapsible='icon']:!px-[0.35rem] group-data-[collapsible='icon']:!px-[0.35rem]"
                  tooltip="Docs"
                  asChild
                >
                  {state === 'collapsed' ? (
                    <a
                      href="https://mastra.ai/docs"
                      target="_blank"
                      rel="noopener"
                      className="text-sm text-gray-300/60 hover:text-gray-100"
                    >
                      Do
                    </a>
                  ) : (
                    <a
                      href="https://mastra.ai/docs"
                      target="_blank"
                      rel="noopener"
                      className="text-sm text-gray-300/60 hover:text-gray-100"
                    >
                      Docs
                    </a>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  className="group-[data-collapsible='icon']:!px-[0.35rem] group-data-[collapsible='icon']:!px-[0.35rem]"
                  tooltip="GitHub"
                  asChild
                >
                  {state === 'collapsed' ? (
                    <a
                      href="https://github.com/mastra-ai/mastra"
                      target="_blank"
                      rel="noopener"
                      className="text-sm text-gray-300/60 hover:text-gray-100"
                    >
                      GH
                    </a>
                  ) : (
                    <a
                      href="https://github.com/mastra-ai/mastra"
                      target="_blank"
                      rel="noopener"
                      className="text-sm text-gray-300/60 hover:text-gray-100"
                    >
                      GitHub
                    </a>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
