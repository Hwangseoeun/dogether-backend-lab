import {
    CURRENT_FOR_READ_GROUP_PER_MEMBER_COUNT,
    CURRENT_GROUP_ACTIVITY_START_AT,
    CURRENT_GROUP_RUNNING_DAY,
    DAY_TODO_PER_MEMBER_COUNT,
    DB_BATCH_INSERT_SIZE,
    getLastIdsOfPastActivityData,
    getReviewerId,
    MEMBER_COUNT,
    MEMBER_PER_GROUP_COUNT
} from "../../test-data-common.js";
import {getDateNDaysLater, getTodayDate} from "../../../util/time-util.js";

// =========== 데이터 배열 ===========
const data_type = "Read";
const member_data = [];
const notification_token_data = [];
const daily_todo_stats_data = [];
const challenge_group_data = [];
const challenge_group_member_data = [];
const last_selected_challenge_group_record_data = [];
const daily_todo_data = [];
const daily_todo_history_data = [];
const daily_todo_history_read_data = [];
const daily_todo_certification_data = [];
const daily_todo_certification_reviewer_data = [];

// =========== 캐싱 ===========
const groupMembersByGroup = {};
const groupIdsByMember = Array.from({ length: MEMBER_COUNT }, () => []);
const todoIdsByMember = Array.from({ length: MEMBER_COUNT }, () => []);

// =========== 메인 로직 ===========
const lastIds = getLastIdsOfPastActivityData();
let challengeGroupId = lastIds.lastChallengeGroupId + 1;
let challengeGroupMemberId = lastIds.lastChallengeGroupMemberId + 1;
let dailyTodoId = lastIds.lastDailyTodoId + 1;  // daily_todo & daily_todo_history
let dailyTodoHistoryReadId = 1;
let dailyTodoCertificationId = lastIds.lastDailyTodoCertificationId + 1;

export async function createCurrentActivityForReadTestData() {
    console.log(`🧑‍🍳 [Const Current Activity Data For Read] 현재 활동 테스트 데이터 생성중...`);
    const testData = await generateTestData();
    console.log(`✅ 현재 활동 테스트 데이터 생성 완료!\n`);

    return testData;
}

async function generateTestData() {
    const todayDate = getTodayDate();

    // 1. challenge_group & challenge_group_member 데이터 생성
    const groupStartAt = CURRENT_GROUP_ACTIVITY_START_AT;
    groupStartAt.setHours(7, 0, 0, 0);
    const groupEndAt = getDateNDaysLater(groupStartAt, CURRENT_GROUP_RUNNING_DAY);
    let joiningGroupId = challengeGroupId;
    const totalChallengeGroupCount = MEMBER_COUNT / MEMBER_PER_GROUP_COUNT * CURRENT_FOR_READ_GROUP_PER_MEMBER_COUNT;

    for (let i = 0; i < totalChallengeGroupCount; i++) {
        const currentChallengeGroupId = challengeGroupId++;
        challenge_group_data.push([
            currentChallengeGroupId,
            `g-${currentChallengeGroupId}`,
            MEMBER_PER_GROUP_COUNT,
            `jc-${currentChallengeGroupId}`,
            "RUNNING",
            groupStartAt,
            groupEndAt,
            groupStartAt,
            todayDate,
            null
        ]);
    }

    for (let i = 0; i < CURRENT_FOR_READ_GROUP_PER_MEMBER_COUNT; i++) {
        for (let j = 0; j < MEMBER_COUNT / MEMBER_PER_GROUP_COUNT; j++) {
            let memberId = 1 + j * MEMBER_PER_GROUP_COUNT;
            for (let k = 0; k < MEMBER_PER_GROUP_COUNT; k++) {
                let currentMemberId = memberId++;
                challenge_group_member_data.push([
                    challengeGroupMemberId++,
                    joiningGroupId,
                    currentMemberId,
                    groupStartAt,
                    todayDate,
                    null
                ]);

                // 그룹별 멤버 캐싱
                if (!groupMembersByGroup[joiningGroupId]) {
                    groupMembersByGroup[joiningGroupId] = [];
                }
                groupMembersByGroup[joiningGroupId].push(currentMemberId);
                groupIdsByMember[currentMemberId - 1].push(joiningGroupId);

                if (i === CURRENT_FOR_READ_GROUP_PER_MEMBER_COUNT - 1) {
                    last_selected_challenge_group_record_data.push([
                        currentMemberId,
                        joiningGroupId,
                        currentMemberId,
                        todayDate,
                        null
                    ]);
                }
            }
            joiningGroupId++;
        }
    }

    for (let day = 0; day < CURRENT_GROUP_RUNNING_DAY; day++) {
        const currentTodoWrittenAt = getDateNDaysLater(groupStartAt, day);
        currentTodoWrittenAt.setHours(8, 0, 0, 0);

        const currentTodoCertifyAt = currentTodoWrittenAt;
        currentTodoCertifyAt.setHours(17, 0, 0, 0);

        for (let memberId = 1; memberId <= MEMBER_COUNT; memberId++) {
            const reviewerId = getReviewerId(memberId);
            for (let i = 0; i < CURRENT_FOR_READ_GROUP_PER_MEMBER_COUNT; i++) {
                let reviewStatusToggle = true;
                for (let j = 0; j < DAY_TODO_PER_MEMBER_COUNT; j++) {
                    // 2. daily_todo & daily_todo_history 데이터 생성
                    const currentTodoId = dailyTodoId++;
                    daily_todo_data.push([
                        currentTodoId,
                        groupIdsByMember[memberId - 1][i],
                        memberId,
                        `td=${currentTodoId}`,
                        "CERTIFY_COMPLETED",
                        currentTodoWrittenAt,
                        todayDate,
                        null
                    ]);
                    daily_todo_history_data.push([
                        currentTodoId,
                        currentTodoId,
                        currentTodoWrittenAt,
                        todayDate,
                        null
                    ]);

                    if (day === CURRENT_GROUP_RUNNING_DAY - 1) {
                        const membersInGroup = groupMembersByGroup[groupIdsByMember[memberId - 1][i]];
                        for (const groupMemberId of membersInGroup) {
                            daily_todo_history_read_data.push([
                                dailyTodoHistoryReadId++,
                                groupMemberId,
                                currentTodoId,
                                todayDate,
                                null
                            ]);
                        }
                    }

                    todoIdsByMember[memberId - 1].push(currentTodoId);

                    // 3. daily_todo_certification & daily_todo_certification_reviewer 데이터 생성
                    // 현재는 투두 개수 == 인증 개수로 고정했지만 인증 개수만 다르게 하고 싶다면 아래 로직을 별도 루프로 분리해야함.
                    const currentTodoCertificationId = dailyTodoCertificationId++;
                    const reviewStatus = (day === 27 && j >= 6) ? "REVIEW_PENDING" : (reviewStatusToggle ? "APPROVE" : "REJECT");
                    const reviewFeedBack = (day === 27 && j >= 6) ? null : (reviewStatusToggle ? `와 미쳤다 ㄷㄷ - ${currentTodoCertificationId}` : `그게 최선인가? ㅎ - ${currentTodoCertificationId}`);
                    reviewStatusToggle = !reviewStatusToggle;

                    daily_todo_certification_data.push([
                        currentTodoCertificationId,
                        currentTodoId,
                        `tc-${currentTodoId}`,
                        `http://certification-media.site/m${memberId}/t${currentTodoId}`,
                        reviewStatus,
                        reviewFeedBack,
                        currentTodoCertifyAt,
                        todayDate,
                        null
                    ]);
                    daily_todo_certification_reviewer_data.push([
                        currentTodoCertificationId,
                        currentTodoCertificationId,
                        reviewerId,
                        reviewStatus,
                        todayDate,
                        null
                    ]);
                }
            }
        }
    }

    return {
        data_type,
        DB_BATCH_INSERT_SIZE,
        member_data,
        notification_token_data,
        daily_todo_stats_data,
        challenge_group_data,
        challenge_group_member_data,
        daily_todo_data,
        daily_todo_history_data,
        daily_todo_history_read_data,
        daily_todo_certification_data,
        daily_todo_certification_reviewer_data,
        last_selected_challenge_group_record_data
    };
}
