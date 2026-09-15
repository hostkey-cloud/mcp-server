import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type PromptMessage = {
  role: "user";
  content: { type: "text"; text: string };
};

function userMessage(text: string): { messages: PromptMessage[] } {
  return { messages: [{ role: "user", content: { type: "text", text } }] };
}

/** Multi-step prompts on top of the tools. */
export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    "order_server_prompt",
    {
      description:
        "Мастер заказа сервера Hostkey: локация → пресет → ОС → ПО → трафик-план → подтверждение стоимости → заказ.",
      argsSchema: {
        location: z
          .string()
          .optional()
          .describe(
            "Желаемая локация (NL/US/FI/DE/IS/TR/UK/ES/IT/PL/CH), если известна",
          ),
        purpose: z
          .string()
          .optional()
          .describe(
            "Назначение сервера (сайт, GPU-инференс, БД…), если известно",
          ),
      },
    },
    ({ location, purpose }) =>
      userMessage(
        [
          "Помоги заказать сервер в Hostkey, действуя строго по шагам:",
          "",
          `1. Локация: ${location ? `пользователь выбрал ${location}` : "уточни у пользователя желаемую локацию (NL/US/FI/DE/IS/TR/UK/ES/IT/PL/CH)"}.`,
          `2. Пресет: ${purpose ? `назначение — ${purpose}. ` : ""}Вызови list_presets для выбранной локации, предложи 2–3 подходящих пресета с ценами (get_preset_pricing) и дождись выбора пользователя.`,
          "3. ОС: вызови list_os для выбранного пресета (instance_id) и предложи варианты; дождись выбора os_id.",
          "4. ПО: вызови list_software и предложи marketplace-приложения, если уместно (soft_id опционален).",
          "5. Трафик: вызови list_traffic_plans и предложи трафик-план (traffic_plan).",
          "6. Параметры доступа: попроси root-пароль (мин. 8 символов, заглавная буква, цифра, спецсимвол, без @ и #) или публичный SSH-ключ, а также желаемый hostname и период оплаты (monthly/quarterly/semi-annually/annually).",
          "7. Обязательно выполни order_server с dry_run=true и покажи пользователю сводку с ориентировочной стоимостью.",
          "8. Только после ЯВНОГО согласия пользователя на стоимость повтори order_server с dry_run=false и confirm=true.",
          "9. Сохрани callback-ключ из ответа и сообщи, что деплой занимает 10–30 минут; предложи проверить статус через check_task. Напомни: доступы придут на email при deploy_notify=true.",
        ].join("\n"),
      ),
  );

  server.registerPrompt(
    "reinstall_server_prompt",
    {
      description:
        "Мастер переустановки ОС на сервере Hostkey с проверками и отслеживанием прогресса.",
      argsSchema: {
        server_id: z.string().optional().describe("ID сервера, если известен"),
      },
    },
    ({ server_id }) =>
      userMessage(
        [
          "Помоги переустановить ОС на сервере Hostkey, действуя строго по шагам:",
          "",
          `1. ${server_id ? `ID сервера: ${server_id}.` : "Выясни ID сервера: вызови get_servers и предложи пользователю выбрать."}`,
          "2. Вызови get_server и get_power_status, покажи текущее состояние и hostname сервера.",
          "3. ЯВНО предупреди пользователя: переустановка удалит ВСЕ данные на дисках. Дождись подтверждения.",
          "4. Вызови list_os для этого сервера, предложи варианты ОС; дождись выбора os_id. При желании пользователя — list_software (soft_id).",
          "5. Собери параметры: новый root-пароль или SSH-ключ, deploy_notify.",
          "6. Вызови reinstall_server с confirm=true и текущим hostname сервера. Если инструмент ответил, что деструктивные операции отключены — объясни пользователю, как включить HOSTKEY_ALLOW_DESTRUCTIVE=1.",
          '7. Сохрани callback-ключ и отслеживай прогресс через check_task до result="OK". Не запускай вторую переустановку, пока идёт текущая.',
          "8. После завершения напомни: пароль root новый; уведомление на email при этом способе может не прийти.",
        ].join("\n"),
      ),
  );

  server.registerPrompt(
    "troubleshoot_server_prompt",
    {
      description:
        "Диагностика проблем с сервером Hostkey: питание, сенсоры, сеть — с рекомендациями.",
      argsSchema: {
        server_id: z.string().optional().describe("ID сервера, если известен"),
      },
    },
    ({ server_id }) =>
      userMessage(
        [
          "Помоги диагностировать проблему с сервером Hostkey, действуя по шагам:",
          "",
          `1. ${server_id ? `ID сервера: ${server_id}.` : "Выясни ID сервера через get_servers (можно фильтровать по IP или тегам: search_servers_by_tag)."}`,
          "2. Собери картину: get_server (карточка), get_power_status (питание), для bare-metal — get_server_sensors (температуры/напряжения).",
          "3. Проанализируй: сервер выключен → предложи power_on (с confirm=true, только с согласия пользователя). Аномалии сенсоров (перегрев, сбой PSU) → рекомендуй обращение в поддержку / remote hands через панель Invapi.",
          "4. Сформулируй краткое резюме: состояние, вероятная причина, рекомендуемые действия. Деструктивные действия (power_off, reboot_server, reinstall_server) — только после явного согласия пользователя.",
        ].join("\n"),
      ),
  );
}
